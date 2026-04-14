import { LoginClient } from "./view";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function LoginPage(props: LoginPageProps) {
  const query = await props.searchParams;
  return (
    <LoginClient
      nextPath={query.next || "/dashboard/nurse"}
      initialErrorCode={query.error ?? null}
    />
  );
}
