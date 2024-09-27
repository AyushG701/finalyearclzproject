import {
  InfiniteData,
  QueryFilters,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { submitPost } from "./actions";
import { useToast } from "@/components/ui/use-toast";
import { PostsPage } from "@/lib/types";
import { useSession } from "@/app/(main)/SessionProvider";

// simpler one in case there is error in the experimental version of this mutation
// export function useSubmitPostMutation() {
//   const { toast } = useToast();

//   const queryClient = useQueryClient();

//   const mutation = useMutation({
//     mutationFn: submitPost,
//     onSuccess: async (newPost) => {
//       const queryFilter: QueryFilters = { queryKey: ["post-feed", "for-you"] };

//       await queryClient.cancelQueries(queryFilter);

//       queryClient.setQueriesData<InfiniteData<PostsPage, string | null>>(
//         queryFilter,
//         (oldData) => {
//           const firstPage = oldData?.pages[0];

//           if (firstPage) {
//             return {
//               pageParams: oldData.pageParams,
//               pages: [
//                 {
//                   posts: [newPost, ...firstPage.posts],
//                   nextCursor: firstPage.nextCursor,
//                 },
//                 ...oldData.pages.slice(1),
//               ],
//             };
//           }
//         },
//       );

//       queryClient.invalidateQueries({
//         queryKey: queryFilter.queryKey,
//         predicate(query) {
//           return !query.state.data;
//         },
//       });

//       toast({
//         description: "Post created",
//       });
//     },
//     onError(error) {
//       console.error(error);
//       toast({
//         variant: "destructive",
//         description: "Failed to post. Please try again.",
//       });
//     },
//   });

//   return mutation;
// }
function generateId() {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

// const id = generateId();
export function useSubmitPostMutation() {
  const { user } = useSession(); // Get user data from session
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: submitPost,

    onMutate: async (content) => {
      const queryKey = ["post-feed", "for-you"];
      await queryClient.cancelQueries(queryKey);

      // Get existing cache
      const previousData =
        queryClient.getQueryData<InfiniteData<PostsPage>>(queryKey);

      // Generate a unique temporary ID for the optimistic post
      const tempId = generateId();

      // Optimistically update the cache
      queryClient.setQueryData<InfiniteData<PostsPage>>(queryKey, (oldData) => {
        const firstPage = oldData?.pages[0];

        if (firstPage) {
          return {
            ...oldData,
            pages: [
              {
                posts: [
                  {
                    id: tempId, // Temporary unique ID
                    content,
                    createdAt: new Date(), // Temporary timestamp
                    user: {
                      id: user?.id || "unknown",
                      username: user?.username || "Anonymous",
                      displayName: user?.displayName || "User",
                      avatarUrl: user?.avatarUrl || null,
                    },
                  },
                  ...firstPage.posts,
                ],
                nextCursor: firstPage.nextCursor,
              },
              ...oldData.pages.slice(1),
            ],
          };
        }
        return oldData;
      });

      // Return context with previous data for rollback
      return { previousData, tempId };
    },

    onSuccess: (newPost, variables, context) => {
      const queryKey = ["post-feed", "for-you"];
      queryClient.setQueryData<InfiniteData<PostsPage>>(queryKey, (oldData) => {
        const firstPage = oldData?.pages[0];
        return {
          ...oldData,
          pages: [
            {
              posts: firstPage.posts.map(
                (post) => (post.id === context.tempId ? newPost : post), // Replace temp post with actual post from the server
              ),
              nextCursor: firstPage.nextCursor,
            },
            ...oldData.pages.slice(1),
          ],
        };
      });

      toast({
        description: "Post created successfully!",
      });
    },

    onError: (error, newPost, context) => {
      const queryKey = ["post-feed", "for-you"];
      // Rollback the optimistic update in case of failure
      queryClient.setQueryData(queryKey, context.previousData);

      toast({
        variant: "destructive",
        description: "Failed to post. Please try again.",
      });
    },
  });

  return mutation;
}
