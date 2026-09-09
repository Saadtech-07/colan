"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlinePageLoader } from "@/components/ui/inline-page-loader";
import { fetchPlatformSettings } from "@/lib/platform/platform-client";
import { parseApiError } from "@/providers/app-state";

export default function PlatformSettingsPage() {
  const [settings, setSettings] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void fetchPlatformSettings()
      .then((data) => {
        setSettings({
          platformName: String(data.settings.platformName ?? "Colan Platform"),
          supportEmail: String(data.settings.supportEmail ?? "support@colan.io"),
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load settings."))
      .finally(() => setLoading(false));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/platform/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      setMessage("Settings saved for this session.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <InlinePageLoader title="Loading settings…" />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Platform Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">Configure global Colan platform preferences.</p>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">General</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void save(e)} className="space-y-4">
            <div>
              <Label htmlFor="platformName">Platform Name</Label>
              <Input
                id="platformName"
                value={settings.platformName ?? ""}
                onChange={(e) => setSettings((s) => ({ ...s, platformName: e.target.value }))}
                className="mt-1.5 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="supportEmail">Support Email</Label>
              <Input
                id="supportEmail"
                type="email"
                value={settings.supportEmail ?? ""}
                onChange={(e) => setSettings((s) => ({ ...s, supportEmail: e.target.value }))}
                className="mt-1.5 rounded-xl"
              />
            </div>
            {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="rounded-xl" disabled={saving}>
              {saving ? "Saving…" : "Save Settings"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
