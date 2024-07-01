import { signIn } from "../auth"
 
export function SignIn():JSX.Element {
  return (
    <form
      action={async () => {
        "use server"
        await signIn("google")
      }}
    >
      <button className="bg-gray-500 p-4 rounded-lg" type="submit">Signin with Google</button>
    </form>
  )
} 