# Codemagic Pipeline — Histórico de Erros e Correções

Documento que registra todos os erros encontrados no pipeline de build iOS via Codemagic e as tentativas de correção, em ordem cronológica.

---

## 1. Code Signing — "No matching profiles found"

**Erro:** O Codemagic não conseguia assinar o app. Tentativas com `distribution_type: ad_hoc` e `distribution_type: development` falharam com "No matching profiles found".

**Causa:** A integração API do App Store Connect (reusada do app "OnSite Calculator") não conseguia criar provisioning profiles automaticamente para o novo bundle ID `com.onsiteclub.minutes`.

**Tentativas:**
1. `distribution_type: ad_hoc` → falhou
2. `distribution_type: development` → falhou
3. Removido `ios_signing` inteiro → falhou

**Solução:** O usuário criou manualmente um **App Store Provisioning Profile** no Apple Developer Portal para `com.onsiteclub.minutes` e fez upload ao Codemagic. Mudou para `distribution_type: app_store`.

---

## 2. Warnings Treated as Errors (Compilação)

**Erro:** Build falhava na compilação do Xcode com warnings tratados como erros:
- `expo-constants`: deprecated `Constants` usage
- `expo-router`: `LinkPreviewNativeNavigation` nullability warnings

**Causa:** Pods do Expo tinham `GCC_TREAT_WARNINGS_AS_ERRORS = YES` nos build settings, e warnings em dependências causavam falha.

**Tentativas (todas falharam):**
1. **Novo `post_install` no Podfile** → Erro: "Specifying multiple post_install hooks is unsupported" (Expo já tem um)
2. **`sed` no `Pods.xcodeproj/project.pbxproj`** → Settings não estavam lá no formato esperado
3. **`--archive-xcargs`** → Não sobrescreveu settings dos Pods
4. **`sed` nos arquivos `.xcconfig`** → Não surtiu efeito nos Pods

**Solução:** Criado **Expo Config Plugin** (`plugins/withSuppressWarnings.js`) que usa `withDangerousMod` para injetar código DENTRO do `post_install` existente no Podfile (via `String.replace`). O plugin seta:
- `GCC_TREAT_WARNINGS_AS_ERRORS = NO`
- `SWIFT_TREAT_WARNINGS_AS_ERRORS = NO`
- `-Wno-error` e `-Wno-nullability-completeness` nos compiler flags

**Arquivo:** `plugins/withSuppressWarnings.js`

---

## 3. "use of undeclared identifier 'RNSBottomTabsScreenComponentView'"

**Erro:** Após resolver os warnings, surgiu erro de compilação em `react-native-screens`.

**Causa:** `react-native-screens@4.24.0` era incompatível com `expo-router@6.0.23` (Expo SDK 54).

**Solução:** `npx expo install --fix` corrigiu 4 pacotes para versões compatíveis:
- `react-native-screens`: 4.24.0 → ~4.16.0
- `react-native-gesture-handler`: 2.30.0 → ~2.28.0
- `react-native-reanimated`: 4.2.2 → ~4.1.1
- `react-native-safe-area-context`: 5.7.0 → ~5.6.0

---

## 4. Build Number — "bundle version must be higher than previously uploaded version: '1'"

**Erro:** Build compilava com sucesso, mas falhava no upload ao TestFlight porque `CFBundleVersion` era sempre `"1"`.

**Causa raiz:** `app.json` tem `"buildNumber": "1"` hardcoded. O `expo prebuild --clean` gera o Xcode project com esse valor. Tentativas de mudar DEPOIS do prebuild não funcionaram.

### Tentativa 1: agvtool (FALHOU)

```yaml
- name: Increment build number
  script: |
    cd ios
    LATEST_BUILD=$(app-store-connect get-latest-testflight-build-number "com.onsiteclub.minutes" || echo 0)
    NEW_BUILD=$((LATEST_BUILD + 1))
    agvtool new-version -all $NEW_BUILD
```

**Problemas:**
- `app-store-connect get-latest-testflight-build-number` espera o **Apple ID numérico** (ex: `1616629701`), não o bundle identifier string. O comando falhava silenciosamente e `|| echo 0` resultava em `NEW_BUILD=1`.
- `agvtool` **não funciona com projetos Expo** porque o Expo não configura `VERSIONING_SYSTEM = apple-generic` no Xcode project. Sem isso, agvtool pode atualizar `project.pbxproj` mas **não atualiza o Info.plist**, que é de onde o IPA lê o `CFBundleVersion`.

### Tentativa 2: agvtool com melhor error handling (FALHOU)

```yaml
- name: Increment build number
  script: |
    cd ios
    LATEST_BUILD=$(app-store-connect get-latest-testflight-build-number "$BUNDLE_ID" 2>/dev/null || true)
    if ! echo "$LATEST_BUILD" | grep -qE '^[0-9]+$'; then
      LATEST_BUILD=1
    fi
    NEW_BUILD=$((LATEST_BUILD + 1))
    agvtool new-version -all $NEW_BUILD
    agvtool what-version
```

**Problema:** Mesmo com melhor handling do fallback, `agvtool` continuava não atualizando o Info.plist. O IPA saía com "Version code: 1".

### Tentativa 3: PlistBuddy + sed no project.pbxproj (NÃO TESTADA)

```yaml
- name: Increment build number
  script: |
    NEW_BUILD=${BUILD_NUMBER:-2}
    PLIST="ios/$SCHEME/Info.plist"
    /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $NEW_BUILD" "$PLIST"
    PBXPROJ="ios/$SCHEME.xcodeproj/project.pbxproj"
    sed -i '' "s/CURRENT_PROJECT_VERSION = [^;]*/CURRENT_PROJECT_VERSION = $NEW_BUILD/" "$PBXPROJ"
```

**Problema:** Esta abordagem (PlistBuddy após prebuild) foi escrita localmente mas **nunca foi commitada e pushed**. O build `7ddf6ea` no Codemagic ainda usava a versão antiga com agvtool. Resultado: 3 builds consecutivos falharam com o mesmo erro.

### Solução final: Modificar app.json ANTES do prebuild (commit `6737fbf`)

```yaml
- name: Set build number in app.json
  script: |
    NEW_BUILD=$(date +%s)
    echo "Setting build number to: $NEW_BUILD"
    node -e "
      const fs = require('fs');
      const app = JSON.parse(fs.readFileSync('app.json'));
      app.expo.ios = app.expo.ios || {};
      app.expo.ios.buildNumber = String($NEW_BUILD);
      fs.writeFileSync('app.json', JSON.stringify(app, null, 2));
      console.log('buildNumber set to:', app.expo.ios.buildNumber);
    "

- name: Prebuild iOS
  script: |
    npx expo prebuild --platform ios --clean
```

**Por que funciona:**
- Modifica `app.json` **ANTES** do `expo prebuild`
- O Expo lê `app.json` e gera o Xcode project com o build number correto desde o início
- Usa `$(date +%s)` (Unix epoch timestamp) — garantido único e sempre crescente
- Não depende de `agvtool`, `PlistBuddy`, variáveis do Codemagic, ou queries ao TestFlight

**Status:** Commitado e pushed. Aguardando resultado do build.

---

## 5. TestFlight Build Não Aparecia

**Erro:** Build era uploaded mas não aparecia no TestFlight.

**Causa:** Faltava `buildNumber` no `app.json`. O campo `ios.buildNumber: "1"` foi adicionado.

**Solução:** Adicionado `"buildNumber": "1"` em `app.json` → `expo.ios`.

---

## Resumo do Pipeline Final (codemagic.yaml)

```
1. Install dependencies     → npm ci
2. Set build number          → node modifica app.json com timestamp
3. Prebuild iOS              → npx expo prebuild --platform ios --clean
4. Find Xcode workspace      → descobre WORKSPACE e SCHEME
5. Install CocoaPods         → cd ios && pod install
6. Set up code signing       → xcode-project use-profiles
7. Build iOS                 → xcode-project build-ipa
8. Publishing                → upload ao TestFlight
```

## Lições Aprendidas

1. **agvtool não funciona com Expo** — projetos gerados por `expo prebuild` não configuram `VERSIONING_SYSTEM = apple-generic`
2. **Modificar ANTES do prebuild, não depois** — o `expo prebuild --clean` gera tudo do zero a partir do `app.json`, qualquer mudança pós-prebuild pode ser ignorada pelo build system
3. **`app-store-connect get-latest-testflight-build-number` precisa do Apple ID numérico**, não do bundle identifier
4. **Sempre verificar se as mudanças foram commitadas e pushed** — 3 builds rodaram com YAML antigo porque as correções ficaram só locais
5. **Expo Config Plugins** são a forma correta de modificar o Podfile — não tente adicionar um segundo `post_install` block
6. **`npx expo install --fix`** é essencial para manter dependências compatíveis com a versão do Expo SDK
