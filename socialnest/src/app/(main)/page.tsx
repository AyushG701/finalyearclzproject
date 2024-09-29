import PostEditor from "@/components/posts/editor/PostEditor";

import ForYouFeed from "./ForYouFeed";
import TrendsSidebar from "@/components/TrendsSidebar";

export default async function Home() {
  // const posts = await prisma.post.findMany({
  //   include: getPostDataInclude(user.id),
  //   orderBy: { createdAt: "desc" },
  // });
  return (
    <main className="flex w-full min-w-0 gap-5">
      <div className="w-full min-w-0 space-y-5">
        <PostEditor />

        <ForYouFeed />
      </div>
      <TrendsSidebar />
    </main>
  );
}
