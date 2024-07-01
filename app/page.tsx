import "regenerator-runtime/runtime";
import Image from "next/image";
import Link from "next/link";
import FormComp from "./components/FormComp";
export default async function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center  p-24">
      <div>
        <h1 className="text-[64px]">Interview AI </h1>
        <h3 className="text-end">by Paras Pipre</h3>
      </div>
      {/* <FormComp /> */}
      <Link className="py-3 px-10 bg-purple-600 rounded-3xl" href="/interview">
        start
      </Link>
    </main>
  );
}
