import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main style={{ minHeight: "100dvh", background: "#0f0f0e", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <SignUp />
    </main>
  );
}
