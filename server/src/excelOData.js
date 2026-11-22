import { Router } from "express";

const reportProperties = {
  group: "Edm.String",
  month: "Edm.String",
  student_id: "Edm.String",
  last_name: "Edm.String",
  first_name: "Edm.String",
  homework: "Edm.Double",
  classwork: "Edm.Double",
  total: "Edm.Double",
  present: "Edm.Int32",
  absent: "Edm.Int32",
};

const metadata = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="JournalExcel" xmlns="http://docs.oasis-open.org/odata/ns/edm">
      <EntityType Name="Report">
        <Key>
          <PropertyRef Name="student_id" />
          <PropertyRef Name="month" />
        </Key>
        ${Object.entries(reportProperties).map(([name, type]) => `<Property Name="${name}" Type="${type}" Nullable="false" />`).join("\n        ")}
      </EntityType>
      <EntityContainer Name="JournalService">
        <EntitySet Name="Reports" EntityType="JournalExcel.Report" />
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

const supportedOptions = new Set(["$format", "$top", "$skip", "$select", "$filter", "$count"]);
const metadataPath = (req) => `${req.baseUrl}/$metadata`;

function queryError(message) {
  return Object.assign(new Error(message), { status: 400, code: "InvalidQuery" });
}

function unsignedOption(query, option, fallback) {
  const value = query[option];
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw queryError(`${option} must be a non-negative integer.`);
  }
  return Number(value);
}

function selection(value) {
  if (value === undefined || value === "*") return Object.keys(reportProperties);
  if (typeof value !== "string") throw queryError("$select must contain report property names.");
  const fields = [...new Set(value.split(",").map((field) => field.trim()))];
  if (fields.some((field) => !Object.hasOwn(reportProperties, field))) {
    throw queryError("$select contains an unknown report property.");
  }
  return fields;
}

function monthFilter(value) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw queryError("$filter must contain a month equality expression.");
  let expression = value.trim();
  if (expression.startsWith("(") && expression.endsWith(")")) expression = expression.slice(1, -1).trim();
  const month = /^month\s+eq\s+'(\d{4}-(?:0[1-9]|1[0-2]))'$/.exec(expression)?.[1];
  if (!month) throw queryError("$filter supports month eq 'YYYY-MM'.");
  return month;
}

function reportQuery(query) {
  for (const name of Object.keys(query)) {
    if (name.startsWith("$") && !supportedOptions.has(name)) throw queryError(`${name} is unsupported for Reports.`);
  }
  if (query.$count !== undefined && !["true", "false"].includes(query.$count)) {
    throw queryError("$count must be true or false.");
  }
  const month = monthFilter(query.$filter);
  if (month && query.month !== undefined && query.month !== month) {
    throw queryError("The month parameter and $filter must select the same month.");
  }
  return {
    top: unsignedOption(query, "$top", undefined),
    skip: unsignedOption(query, "$skip", 0),
    fields: selection(query.$select),
    month,
    count: query.$count === "true",
  };
}

function sendJson(res, payload) {
  return res.type("application/json;odata.metadata=minimal").json(payload);
}

export default function excelOData(loadRows) {
  const router = Router({ mergeParams: true });
  router.use((_req, res, next) => {
    res.set({ "OData-Version": "4.0", "Cache-Control": "no-store" });
    next();
  });

  router.get("/", (req, res) => sendJson(res, {
    "@odata.context": metadataPath(req),
    value: [{ name: "Reports", kind: "EntitySet", url: "Reports" }],
  }));

  router.get(/^\/\$metadata\/?$/, (_req, res) => res.type("application/xml").send(metadata));

  router.get("/Reports", async (req, res, next) => {
    try {
      const { top, skip, fields, month, count } = reportQuery(req.query);
      const rows = await loadRows(req, month);
      const page = rows.slice(skip, top === undefined ? undefined : skip + top);
      const select = req.query.$select !== undefined && req.query.$select !== "*" ? `(${fields.join(",")})` : "";
      sendJson(res, {
        "@odata.context": `${metadataPath(req)}#Reports${select}`,
        ...(count && { "@odata.count": rows.length }),
        value: page.map((row) => Object.fromEntries(fields.map((field) => [field, row[field]]))),
      });
    } catch (error) {
      if (!error.status || error.status >= 500) return next(error);
      sendJson(res.status(error.status), { error: { code: String(error.code || error.status), message: error.message } });
    }
  });

  return router;
}
