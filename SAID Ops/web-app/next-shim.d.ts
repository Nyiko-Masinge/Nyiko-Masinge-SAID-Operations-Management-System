// The installed Next runtime is sufficient for this local prototype. These small
// declarations keep TypeScript resilient in restricted teaching-lab installs
// where the package's optional declaration files are not materialised.
declare module 'next' { export type Metadata = Record<string, unknown>; }
declare module 'next/link' { const Link: any; export default Link; }
declare module 'next/navigation' { export const usePathname: any; export const useRouter: any; }
