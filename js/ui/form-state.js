/*
 * Read the form into a plain formState object, the input of the pure
 * core modules. Irrelevant fields (e.g. a hidden step) are still read;
 * the core rules decide what applies to the chosen category.
 */
export function readFormState(form) {
  const data = new FormData(form);
  const text = (name) => String(data.get(name) ?? "");
  return {
    category: data.get("category") || null,
    transaction_ids: data.getAll("transaction_ids").map(String),
    card_last4: data.get("card_last4") || null,
    incident_occurred_at: text("incident_occurred_at"),
    incident_location: text("incident_location"),
    used_after: data.has("used_after"),
    card_in_possession: data.get("card_in_possession") || null,
    shared_credentials: data.get("shared_credentials") || null,
    description: text("description"),
    contact_channel: data.get("contact_channel") || null,
    contact_value: text("contact_value"),
    declaration: data.has("declaration"),
    freeze_card_requested: data.has("freeze_card_requested"),
  };
}
