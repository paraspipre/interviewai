import { signIn } from "../auth";

export function SignIn(): JSX.Element {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google");
      }}
    >
      <button
        className="bg-purple-600 hover:bg-purple-700 transition-colors text-white p-4 rounded-lg font-medium"
        type="submit"
      >
        Sign in with Google
      </button>
    </form>
  );
}
