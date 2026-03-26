import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main style={{ minHeight: "100dvh", background: "#0f0f0e", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <SignIn />
    </main>
  );
}
