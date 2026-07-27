## ADDED Requirements

### Requirement: Product-scoped dashboard session
The dashboard SHALL use an authenticated product key to list and query only the
app resolved from that key while preserving Local/Staging environment
selection within that app.

#### Scenario: Polaris product key unlocks the dashboard
- **WHEN** the operator unlocks with the active Polaris product key
- **THEN** the app list contains only `polaris` and its durable Local/Staging environments

#### Scenario: Product session requests another app
- **WHEN** a product-scoped session requests installation, endpoint, or failure data with a different app identifier
- **THEN** the request is rejected before querying product data

#### Scenario: Existing Polaris traffic is displayed
- **WHEN** the Polaris product key unlocks after Local and Staging traffic already exists
- **THEN** the dashboard displays the existing Polaris environments and endpoint data without reissuing a key or rewriting telemetry
