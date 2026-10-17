import { LinkButton } from "@/components/ui";

export function LoginPrompt() {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <LinkButton href="/login">Log in</LinkButton>
      <LinkButton href="/register" variant="secondary">
        Register
      </LinkButton>
    </div>
  );
}
