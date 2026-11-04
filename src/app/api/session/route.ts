import { creatorName } from "@/lib/creator-name";
import { requireUser, failure } from "@/lib/supabase";
export async function GET() {
  try {
    const { db, user } = await requireUser();
    const { data: stores, error } = await db.rpc("merkelapp_my_stores");
    if (error) throw error;
    return Response.json({
      id: user.id,
      stores,
      name: user.user_metadata.display_name || user.email,
      email: user.email,
      creatorName: creatorName(user),
    });
  } catch (e) {
    return failure(e);
  }
}
