import type { ConfigContext, ExpoConfig } from 'expo/config';

const IOS_URL_SCHEME =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ??
  'com.googleusercontent.apps.497007232019-dh5pgdu54gfa91qq0ss7vb5b9l58s8ot';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'MentorForge-mobile',
  slug: config.slug ?? 'MentorForge-mobile',
  plugins: [
    ...(config.plugins ?? []),
    [
      '@react-native-google-signin/google-signin',
      { iosUrlScheme: IOS_URL_SCHEME },
    ],
  ],
});
