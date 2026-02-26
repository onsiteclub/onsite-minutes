import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "../lib/theme";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.dark },
          headerTintColor: colors.light,
          headerTitleStyle: { fontWeight: "600" },
          contentStyle: { backgroundColor: colors.dark },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="meeting/[id]"
          options={{ title: "Gravando", headerBackTitle: "Voltar" }}
        />
        <Stack.Screen
          name="meeting/result/[id]"
          options={{ title: "Ata da Reunião", headerBackTitle: "Voltar" }}
        />
      </Stack>
    </>
  );
}
