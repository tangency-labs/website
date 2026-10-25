import assert from "node:assert/strict";
import { test } from "node:test";
import { homeStructuredData } from "../src/lib/structured-data.ts";

test("home JSON-LD describes organization, application and website", () => {
	const data = homeStructuredData("v1.2.3");
	const json = JSON.parse(JSON.stringify(data));
	assert.equal(json["@context"], "https://schema.org");
	const byType = Object.fromEntries(
		json["@graph"].map((n: { "@type": string }) => [n["@type"], n]),
	);
	assert.equal(byType.Organization.name, "Tangency Labs");
	assert.match(byType.Organization.logo, /^https:\/\/solidcraft\.io\/brand\//);
	assert.equal(byType.SoftwareApplication.softwareVersion, "1.2.3");
	assert.equal(byType.SoftwareApplication.offers.price, "0");
	assert.equal(
		byType.SoftwareApplication.applicationCategory,
		"DesignApplication",
	);
	assert.equal(byType.WebSite.alternateName, "SolidCraft CAD");
});
