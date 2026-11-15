# Facility names: real-world references, synthetic figures

## What changed

Facility display names are no longer fictional. They reference **real, public health institutions** located in the five countries the Gates Foundation has publicly named as its Africa focus countries: **Nigeria, Burkina Faso, Ethiopia, Kenya, and South Africa** ([focus-country announcement](https://www.forbes.com/sites/carlieporterfield/2022/11/17/bill-gates-foundation-pledges-7-billion-to-support-africa-health-and-agriculture/)).

## What this does NOT mean

- The Foundation publishes **country- and program-level** commitments (e.g., primary-health-care revitalization in Nigeria), not a verified facility-by-facility "covered facilities" roster. No authorized facility roster was found in the connected workspace when this seed was built. We therefore do **not** claim any listed facility receives Foundation funding.
- Every stock balance, consumption history, batch, shipment, budget, cost, and risk label attached to these names is **synthetic**. Nothing here describes the actual stock, performance, or finances of the named institution.
- Names are used only as recognizable, respectful placeholders so the demo reads like a real workspace. Each facility carries a `nameReference` object (`country`, `source`, `note`) and the UI repeats the disclaimer wherever a name appears.

## Roster and sources

| Country (demo district) | Facility | Type | Public source |
|---|---|---|---|
| Nigeria | Lagos University Teaching Hospital | hospital | https://luth.gov.ng/ |
| Nigeria | National Hospital Abuja | hospital | https://nationalhospital.gov.ng/ |
| Nigeria | Aminu Kano Teaching Hospital | hospital | https://akth.org.ng/ |
| Nigeria | University College Hospital Ibadan | hospital | https://uch-ibadan.org.ng/ |
| Burkina Faso | CHU Yalgado Ouédraogo | hospital | https://en.wikipedia.org/wiki/Yalgado_Ou%C3%A9draogo_Teaching_Hospital |
| Burkina Faso | CHU de Bogodogo | hospital | https://en.wikipedia.org/wiki/Bogodogo_University_Hospital |
| Burkina Faso | CHU Sourô Sanou | hospital | https://en.wikipedia.org/wiki/Sour%C3%B4_Sanou_University_Hospital |
| Ethiopia | Tikur Anbessa Specialized Hospital | hospital | https://en.wikipedia.org/wiki/Tikur_Anbessa_Specialized_Hospital |
| Ethiopia | St. Paul's Hospital Millennium Medical College | hospital | https://en.wikipedia.org/wiki/St._Paul%27s_Hospital_Millennium_Medical_College |
| Ethiopia | Gandhi Memorial Hospital | hospital | https://en.wikipedia.org/wiki/Gandhi_Memorial_Hospital |
| Ethiopia | Zewditu Memorial Hospital | hospital | https://en.wikipedia.org/wiki/Zewditu_Memorial_Hospital |
| Kenya | Kenyatta National Hospital | hospital | https://knh.or.ke/ |
| Kenya | Moi Teaching and Referral Hospital | hospital | https://mtrh.or.ke/ |
| Kenya | Kibera South Health Centre | health_centre | https://www.msf.org.za/covid-19-east-africa |
| Kenya | Mathare North Health Centre | health_centre | https://afya360.co.ke/health-facility/mathare-north-health-centre/901 |
| South Africa | Chris Hani Baragwanath Academic Hospital | hospital | https://en.wikipedia.org/wiki/Chris_Hani_Baragwanath_Academic_Hospital |
| South Africa | Groote Schuur Hospital | hospital | https://en.wikipedia.org/wiki/Groote_Schuur_Hospital |
| South Africa | Steve Biko Academic Hospital | hospital | https://en.wikipedia.org/wiki/Steve_Biko_Academic_Hospital |

Sources are public reference entry points, not verified data endpoints. If a name or link is contested or out of date, replace it in `scripts/generate-data.ts` and regenerate; the manifest checksum will change accordingly.

## Before any real deployment

Real facility names must only be paired with **authorized, verified aggregate data** under a signed data-sharing agreement and local clinical governance (see `docs/COUNTRY_DATA.md`). Until then, keep the synthetic envelope and the persistent disclaimer.
