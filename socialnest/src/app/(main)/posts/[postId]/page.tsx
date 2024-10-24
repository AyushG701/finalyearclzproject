import { validateRequest } from "@/auth";
import FollowButton from "@/components/FollowButton";
import Linkify from "@/components/Linkify";
import Post from "@/components/posts/Post";
import UserAvatar from "@/components/UserAvatar";
import UserTooltip from "@/components/UserTooltip";
import prisma from "@/lib/prisma";
import { getPostDataInclude, UserData } from "@/lib/types";
import { Loader2 } from "lucide-react";
import { Metadata } from "next";
import Link from "next/link"; // Link component for navigation between pages.
import { notFound } from "next/navigation";
import { cache, Suspense } from "react"; // `cache` for caching data and `Suspense` for lazy loading.

// Define the `PageProps` interface that includes a postId parameter from the URL.
interface PageProps {
  params: { postId: string };
}

// Cached function to fetch a post by its ID and include additional data (like user info, attachments).
const getPost = cache(async (postId: string, loggedInUserId: string) => {
  // Query the database for the post with the given postId and include additional data.
  const post = await prisma.post.findUnique({
    where: {
      id: postId, // Find post by its unique ID.
    },
    include: getPostDataInclude(loggedInUserId), // Include related data based on the logged-in user (e.g., user details, likes).
  });

  // If no post is found, return a 404 page.
  if (!post) notFound();

  // Return the fetched post data.
  return post;
});

// Generate metadata for the page, including a dynamic page title.
export async function generateMetadata({
  params: { postId },
}: PageProps): Promise<Metadata> {
  // Validate the user's session.
  const { user } = await validateRequest();

  // If no user is found, return an empty metadata object.
  if (!user) return {};

  // Fetch the post to extract data for the page title.
  const post = await getPost(postId, user.id);

  // Return the metadata with a dynamic title showing the user's display name and a snippet of the post content.
  return {
    title: `${post.user.displayName}: ${post.content.slice(0, 50)}...`,
  };
}

// Main page component that displays the post and user information.
export default async function Page({ params: { postId } }: PageProps) {
  // Validate the user session to check if the user is logged in.
  const { user } = await validateRequest();

  // If no user is logged in, show an unauthorized message.
  if (!user) {
    return (
      <p className="text-destructive">
        You&apos;re not authorized to view this page.
      </p>
    );
  }

  // Fetch the post using the cached `getPost` function, passing the postId and logged-in user's ID.
  const post = await getPost(postId, user.id);

  // Return the main layout of the page.
  return (
    <main className="flex w-full min-w-0 gap-5">
      <div className="w-full min-w-0 space-y-5">
        {/* Render the post content using the `Post` component. */}
        <Post post={post} />
      </div>

      {/* Sidebar for showing user information, which sticks to the top of the screen when scrolling. */}
      <div className="sticky top-[5.25rem] hidden h-fit w-80 flex-none lg:block">
        {/* Render the user info in the sidebar, with a loading spinner while the content is loading. */}
        <Suspense fallback={<Loader2 className="mx-auto animate-spin" />}>
          <UserInfoSidebar user={post.user} />
        </Suspense>
      </div>
    </main>
  );
}

// Interface for the `UserInfoSidebar` props, which requires a `user` object.
interface UserInfoSidebarProps {
  user: UserData;
}

// Sidebar component that displays information about the post author.
async function UserInfoSidebar({ user }: UserInfoSidebarProps) {
  // Validate the logged-in user.
  const { user: loggedInUser } = await validateRequest();

  // If no user is logged in, do not show the sidebar.
  if (!loggedInUser) return null;

  // Return the user info section with styling and details.
  return (
    <div className="space-y-5 rounded-2xl bg-card p-5 shadow-sm">
      {/* Header text for the user info section. */}
      <div className="text-xl font-bold">About this user</div>

      {/* Tooltip showing additional information about the user when hovered over. */}
      <UserTooltip user={user}>
        {/* Link to the user's profile page. */}
        <Link
          href={`/users/${user.username}`}
          className="flex items-center gap-3"
        >
          {/* Render the user's avatar (profile image). */}
          <UserAvatar avatarUrl={user.avatarUrl} className="flex-none" />
          <div>
            {/* Display the user's display name with hover effect. */}
            <p className="line-clamp-1 break-all font-semibold hover:underline">
              {user.displayName}
            </p>
            {/* Display the user's username in muted style. */}
            <p className="line-clamp-1 break-all text-muted-foreground">
              @{user.username}
            </p>
          </div>
        </Link>
      </UserTooltip>

      {/* Render the user's bio, converting URLs to clickable links. */}
      <Linkify>
        <div className="line-clamp-6 whitespace-pre-line break-words text-muted-foreground">
          {user.bio}
        </div>
      </Linkify>

      {/* Show a follow button if the logged-in user is not the same as the post author. */}
      {user.id !== loggedInUser.id && (
        <FollowButton
          userId={user.id}
          initialState={{
            followers: user._count.followers, // Initial number of followers.
            isFollowedByUser: user.followers.some(
              ({ followerId }) => followerId === loggedInUser.id, // Check if the logged-in user already follows the author.
            ),
          }}
        />
      )}
    </div>
  );
}
