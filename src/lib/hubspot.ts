// Securafy-specific HubSpot sync (its own portal, 46124718) — not available
// to other tenants in v1, see PRD.md non-goals and spec/plan.md Tech decisions.
//
// Gated on org_id, not just on HUBSPOT_PRIVATE_APP_TOKEN being set: this app
// is a single shared multi-tenant deployment, so an env var alone would sync
// every tenant's prospects into Securafy's CRM.

const HUBSPOT_API_BASE = "https://api.hubapi.com";
// HubSpot's default HUBSPOT_DEFINED association type id for note -> contact.
const NOTE_TO_CONTACT_ASSOCIATION_TYPE_ID = 202;

export const SECURAFY_ORG_ID = "00000000-0000-0000-0000-000000000001";

type SyncPackageToHubSpotInput = {
  orgId: string;
  prospectEmail: string | null;
  prospectName: string;
  prospectCompany: string | null;
  packageSlug: string;
};

/**
 * Upserts the prospect as a HubSpot contact and logs a note when a package
 * is created. Fire-and-forget from the caller's perspective: never throws,
 * so a CRM hiccup can't block a rep from sending a package.
 */
export async function syncPackageToHubSpot(
  input: SyncPackageToHubSpotInput,
): Promise<void> {
  if (input.orgId !== SECURAFY_ORG_ID) return;

  // Named SECURAFY_-prefixed, not the generic HUBSPOT_PRIVATE_APP_TOKEN, to
  // avoid colliding with an unrelated env var of that generic name already
  // set on some machines for a different project.
  const token = process.env.SECURAFY_HUBSPOT_TOKEN;
  if (!token) {
    console.warn("HubSpot sync skipped: SECURAFY_HUBSPOT_TOKEN not set");
    return;
  }
  if (!input.prospectEmail) {
    console.warn(
      `HubSpot sync skipped for ${input.packageSlug}: no prospect email`,
    );
    return;
  }

  try {
    const contactId = await upsertContact(token, input);
    if (contactId) {
      await logPackageNote(token, contactId, input);
    }
  } catch (err) {
    console.error("HubSpot sync failed:", err);
  }
}

async function upsertContact(
  token: string,
  input: SyncPackageToHubSpotInput,
): Promise<string | null> {
  const [firstname, ...rest] = input.prospectName.trim().split(/\s+/);
  const lastname = rest.join(" ") || undefined;

  const res = await fetch(
    `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/batch/upsert`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: [
          {
            idProperty: "email",
            id: input.prospectEmail,
            properties: {
              email: input.prospectEmail,
              firstname,
              ...(lastname ? { lastname } : {}),
              ...(input.prospectCompany
                ? { company: input.prospectCompany }
                : {}),
            },
          },
        ],
      }),
    },
  );

  if (!res.ok) {
    console.error(
      "HubSpot contact upsert failed:",
      res.status,
      await res.text(),
    );
    return null;
  }

  const body = (await res.json()) as { results?: Array<{ id: string }> };
  return body.results?.[0]?.id ?? null;
}

async function logPackageNote(
  token: string,
  contactId: string,
  input: SyncPackageToHubSpotInput,
): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const packageUrl = `${siteUrl}/s/${input.packageSlug}`;

  const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/notes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        hs_note_body: `Sent an ActiDesk package: ${packageUrl}`,
        hs_timestamp: Date.now(),
      },
      associations: [
        {
          to: { id: contactId },
          types: [
            {
              associationCategory: "HUBSPOT_DEFINED",
              associationTypeId: NOTE_TO_CONTACT_ASSOCIATION_TYPE_ID,
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    console.error(
      "HubSpot note creation failed:",
      res.status,
      await res.text(),
    );
  }
}
