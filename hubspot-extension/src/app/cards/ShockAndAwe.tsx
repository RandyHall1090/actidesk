import React from "react";
import { hubspot, Text, Flex, Link } from "@hubspot/ui-extensions";
import { useCrmProperties } from "@hubspot/ui-extensions/crm";

// Base URL for the Online Shock-and-Awe portal's New Package form. Its
// prospect_name/prospect_email query-param prefill already shipped there
// (see spec/plan.md T29) — this card only needs to build the URL.
const SHOCK_AND_AWE_NEW_PACKAGE_URL =
  "https://securafy-shock-and-awe.vercel.app/packages/new";

// Manual query-string building (encodeURIComponent, a plain ECMAScript
// global) instead of URL/URLSearchParams: those are DOM/WebWorker-lib
// types not confirmed available in the UI-extension sandbox runtime,
// which HubSpot's own docs say has no real window/document/fetch.
function buildPackageUrl(properties) {
  const firstName = (properties.firstname ?? "").trim();
  const lastName = (properties.lastname ?? "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const email = (properties.email ?? "").trim();

  const params = [];
  if (fullName) params.push(`prospect_name=${encodeURIComponent(fullName)}`);
  if (email) params.push(`prospect_email=${encodeURIComponent(email)}`);

  return params.length
    ? `${SHOCK_AND_AWE_NEW_PACKAGE_URL}?${params.join("&")}`
    : SHOCK_AND_AWE_NEW_PACKAGE_URL;
}

const ShockAndAweCard = () => {
  const { properties, isLoading, error } = useCrmProperties([
    "firstname",
    "lastname",
    "email",
  ]);

  if (isLoading) {
    return <Text>Loading contact details…</Text>;
  }

  if (error) {
    return <Text>Couldn't load this contact's details: {error.message}</Text>;
  }

  const packageUrl = buildPackageUrl(properties);
  const hasEmail = Boolean(properties.email && properties.email.trim());

  return (
    <Flex direction="column" gap="medium">
      <Link href={{ url: packageUrl, external: true }} variant="primary">
        Send Shock-and-Awe Package
      </Link>
      {!hasEmail && (
        <Text>
          No email on file for this contact — you can still open the form
          and enter it manually.
        </Text>
      )}
    </Flex>
  );
};

hubspot.extend(() => <ShockAndAweCard />);
