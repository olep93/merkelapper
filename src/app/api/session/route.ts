import { requireUser, failure } from "@/lib/supabase";
export async function GET() {
  try {
    const { user } = await requireUser();
    return Response.json({
      name: user.user_metadata.display_name || user.email,
      email: user.email,
    });
  } catch (e) {
    return failure(e);
  }
}
