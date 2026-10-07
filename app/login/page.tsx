"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Box, Button, Callout, Card, Flex, Heading, IconButton, Text, TextField } from "@radix-ui/themes";
import { ExclamationTriangleIcon, EyeClosedIcon, EyeOpenIcon } from "@radix-ui/react-icons";
import { ApiError, useAuth } from "@/lib/client";
import { useThemeMode } from "@/components/AppTheme";

// In production the agency comes from the portal's domain; locally it defaults from the env.
const DEFAULT_TENANT = process.env.NEXT_PUBLIC_TENANT_SLUG ?? "kaitos";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { status, login } = useAuth();
  const { brand } = useThemeMode();
  const [f, setF] = useState({ tenant: DEFAULT_TENANT, email: "", password: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError>();
  // Only allow same-site relative paths, so ?next= can't send users to another site.
  const next = params.get("next")?.startsWith("/") && !params.get("next")!.startsWith("//") ? params.get("next")! : "/";

  useEffect(() => {
    if (status === "signed-in") router.replace(next);
  }, [status, next, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await login(f.tenant.trim(), f.email.trim(), f.password);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("Can't reach the server. Check your connection and try again.", 0));
      setBusy(false);
    }
  }

  return (
    <Flex align="center" justify="center" minHeight="100vh" p="4">
      <Card size="4" style={{ width: "100%", maxWidth: 400 }}>
        <Heading size="6" mb="1">{brand.name}</Heading>
        <Text as="p" size="2" color="gray" mb="5">Sign in to the admin portal</Text>
        {error && (
          <Callout.Root color="red" mb="4" role="alert">
            <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
            <Callout.Text>{error.status === 429 ? "Too many attempts. Wait a minute and try again." : error.message}</Callout.Text>
          </Callout.Root>
        )}
        <form onSubmit={submit}>
          <Flex direction="column" gap="3">
            <label>
              <Text as="div" size="2" weight="medium" mb="1">Agency</Text>
              <TextField.Root value={f.tenant} onChange={(e) => setF({ ...f, tenant: e.target.value })} autoComplete="organization" required />
            </label>
            <label>
              <Text as="div" size="2" weight="medium" mb="1">Email</Text>
              <TextField.Root type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="username" autoFocus required />
            </label>
            <label>
              <Text as="div" size="2" weight="medium" mb="1">Password</Text>
              <TextField.Root type={show ? "text" : "password"} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="current-password" required>
                <TextField.Slot side="right">
                  <IconButton type="button" size="1" variant="ghost" color="gray" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}>
                    {show ? <EyeClosedIcon /> : <EyeOpenIcon />}
                  </IconButton>
                </TextField.Slot>
              </TextField.Root>
            </label>
            <Box mt="2"><Button type="submit" size="3" style={{ width: "100%" }} loading={busy}>Sign in</Button></Box>
          </Flex>
        </form>
      </Card>
    </Flex>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
