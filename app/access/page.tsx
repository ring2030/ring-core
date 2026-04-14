import { redirect } from "next/navigation";

type AccessPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function AccessPage(props: AccessPageProps) {
  const query = await props.searchParams;
  const token = query.token;
  if (!token) {
    redirect("/login?error=token_missing");
  }
  redirect(`/api/invite/consume?token=${encodeURIComponent(token)}`);
}
