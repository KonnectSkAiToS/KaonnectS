import type { Metadata } from "next";
import "@radix-ui/themes/styles.css";
import "./globals.css";
import { db } from "@/lib/data";
import { RoleProvider } from "@/lib/client";
import { Shell } from "@/components/Shell";
import { AppTheme, THEME_SCRIPT, type Brand } from "@/components/AppTheme";

// Branding is read per request so a white-label change shows on the very first paint.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = db.tenants.find((x) => x.id === db.currentTenantId)!;
  return { title: `${t.name} · Admin`, description: "Agency admin portal: shifts, rota, compliance, attendance and timesheets" };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  const t = db.tenants.find((x) => x.id === db.currentTenantId)!;
  const brand: Brand = { name: t.name, brandColor: t.brandColor };
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <AppTheme initialBrand={brand}>
          <RoleProvider>
            <Shell>{children}</Shell>
          </RoleProvider>
        </AppTheme>
      </body>
    </html>
  );
}
