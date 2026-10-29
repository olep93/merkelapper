/** Short attribution from the account profile, never a name supplied by the sheet. */
export function creatorName(user: {
  user_metadata: Record<string, unknown>;
  email?: string;
}) {
  const metadata = user.user_metadata;
  const profile = [
    metadata.display_name,
    metadata.full_name,
    metadata.name,
  ].find(
    (value): value is string =>
      typeof value === "string" && Boolean(value.trim()),
  );
  const source =
    profile || user.email?.split("@")[0].replace(/[._]+/g, " ") || "Bruker";
  const words = source.normalize("NFC").trim().split(/\s+/);
  const first = words[0];
  const last = words.length > 1 ? words.at(-1)!.replace(/\.+$/, "") : "";
  return (
    last ? `${first} ${[...last][0].toLocaleUpperCase("nb-NO")}.` : first
  ).slice(0, 60);
}
