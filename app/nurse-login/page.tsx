import { LoginClient } from "../login/view";

type NurseLoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function NurseLoginPage(props: NurseLoginPageProps) {
  const query = await props.searchParams;
  return (
    <LoginClient
      nextPath={query.next || "/dashboard/nurse"}
      initialErrorCode={query.error ?? null}
    />
  );
}
