# Chatb rules

Forward only supported session transport headers and the original Host to the Chat owner gateway.
Tenant and database context must come from Platform's verified session. Never forward caller tenant or database selectors.
Pass company selection only through the existing public query contract for owner validation inside that tenant.
Preserve frame types and bounded payloads. Handle connection setup, rejection, abrupt closure, and graceful shutdown.
Keep URL tokens out of the gateway. Native Authorization headers remain subject to Platform verification.
Confirm owner protocol readiness before releasing client frames. Dependency readiness must fail when Platform is unavailable.
