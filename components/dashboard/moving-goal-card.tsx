"use client";

import { useState } from "react";
import { Target, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SECTION_TITLE =
  "flex items-center gap-2 text-[15px] font-extrabold uppercase tracking-[0.04em]";

export function MovingGoalCard({
  campaignId,
  csrfToken,
  autoStretchGoal,
  stretchGoalPercent,
  stretchGoalTriggerPercent,
  onSaved,
}: {
  campaignId: string;
  csrfToken: string;
  autoStretchGoal: boolean;
  stretchGoalPercent: number;
  stretchGoalTriggerPercent: number;
  onSaved?: () => void;
}) {
  const [enabled, setEnabled] = useState(autoStretchGoal);
  const [stretchPercent, setStretchPercent] = useState(String(stretchGoalPercent));
  const [triggerPercent, setTriggerPercent] = useState(
    String(stretchGoalTriggerPercent)
  );
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          autoStretchGoal: enabled,
          stretchGoalPercent: parseInt(stretchPercent, 10),
          stretchGoalTriggerPercent: parseInt(triggerPercent, 10),
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Failed to save moving goal");
      }
      setNotice("Moving goal saved");
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save moving goal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className={SECTION_TITLE}>
          <Target className="w-5 h-5" />
          Moving goal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          When donations get close to the goal, raise it automatically so the
          campaign keeps a target to chase. Caps at 4× the original goal.
        </p>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4"
          />
          Stretch the goal as we get close
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="stretchGoalTriggerPercent">Trigger at (% of goal)</Label>
            <Input
              id="stretchGoalTriggerPercent"
              type="number"
              min={50}
              max={99}
              value={triggerPercent}
              onChange={(e) => setTriggerPercent(e.target.value)}
              className="mt-2"
              disabled={!enabled}
            />
          </div>
          <div>
            <Label htmlFor="stretchGoalPercent">Raise by (%)</Label>
            <Input
              id="stretchGoalPercent"
              type="number"
              min={10}
              max={100}
              value={stretchPercent}
              onChange={(e) => setStretchPercent(e.target.value)}
              className="mt-2"
              disabled={!enabled}
            />
          </div>
        </div>
        <Button size="sm" onClick={save} disabled={saving || !csrfToken}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Save moving goal
        </Button>
        {notice && (
          <p role="status" className="text-sm text-success-dark">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
