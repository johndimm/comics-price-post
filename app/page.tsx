import { getAllComics } from "@/lib/comics";
import CollectionClient from "@/components/CollectionClient";

export default async function Home() {
  const comics = getAllComics();
  return <CollectionClient comics={comics} />;
}
