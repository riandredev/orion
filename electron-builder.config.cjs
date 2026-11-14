const macSigned = Boolean(process.env.CSC_LINK)

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.orion.presenter',
  productName: 'Orion',
  executableName: 'Orion',
  extraMetadata: {
    desktopName: 'orion.desktop'
  },
  directories: {
    output: 'dist/standard'
  },
  files: [
    '**/*',
    '!src',
    '!src/**',
    '!scripts',
    '!scripts/**',
    '!dist',
    '!dist/**',
    '!media',
    '!media/**',
    '!order-images',
    '!order-images/**',
    '!bibles',
    '!bibles/**',
    '!hymnals',
    '!hymnals/**',
    '!images',
    '!images/**',
    '!output-helper',
    '!output-helper/**',
    '!build/content-standard',
    '!build/content-standard/**',
    '!**/*.tsbuildinfo',
    '!**/*.md'
  ],
  extraResources: [
    { from: 'build/icon.png', to: 'icon.png' },
    { from: 'build/edition-standard.json', to: 'edition.json' },
    { from: 'bundles/catalog.json', to: 'content/bundles-catalog.json' },
    { from: 'build/content-standard/hymnals', to: 'content/hymnals' },
    { from: 'bibles/eng-kjv', to: 'content/bibles/eng-kjv' },
    { from: 'output-helper/target/release/orion-output.exe', to: 'orion-output.exe' }
  ],
  asarUnpack: ['**/*.node', '**/7zip-bin/**'],
  npmRebuild: false,
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'build/icon.png'
  },
  mac: {
    target: [{ target: 'dmg', arch: ['universal'] }],
    category: 'public.app-category.productivity',
    icon: 'build/icons/1024x1024.png',
    artifactName: 'Orion-${version}-mac.${ext}',
    darkModeSupport: true,
    minimumSystemVersion: '11.0',
    identity: macSigned ? undefined : null,
    hardenedRuntime: macSigned,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    x64ArchFiles: '**/app.asar.unpacked/**'
  },
  linux: {
    syncDesktopName: true,
    target: [{ target: 'AppImage', arch: ['x64'] }],
    category: 'Office',
    icon: 'build/icons',
    executableName: 'orion',
    synopsis: 'Orion church presentation',
    desktop: {
      entry: {
        StartupWMClass: 'orion',
        Icon: 'orion'
      }
    }
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    shortcutName: 'Orion',
    uninstallDisplayName: 'Orion',
    artifactName: 'Orion-${version}-windows-setup.${ext}'
  },
  appImage: {
    artifactName: 'Orion-${version}-linux.${ext}'
  },
  dmg: {
    artifactName: 'Orion-${version}-mac.${ext}',
    title: 'Orion ${version}'
  }
}
