const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function withSuppressWarnings(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );
      let podfile = fs.readFileSync(podfilePath, "utf8");

      const injection = `
    # [withSuppressWarnings] Suppress warnings-as-errors in all Pods targets
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        bc.build_settings['GCC_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
        bc.build_settings['SWIFT_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
        existing_cflags = bc.build_settings['OTHER_CFLAGS'] || '$(inherited)'
        bc.build_settings['OTHER_CFLAGS'] = existing_cflags + ' -Wno-error -Wno-nullability-completeness'
        existing_cppflags = bc.build_settings['OTHER_CPLUSPLUSFLAGS'] || '$(inherited)'
        bc.build_settings['OTHER_CPLUSPLUSFLAGS'] = existing_cppflags + ' -Wno-error -Wno-nullability-completeness'
      end
    end`;

      podfile = podfile.replace(
        /post_install do \|installer\|/,
        `post_install do |installer|${injection}`
      );

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};
