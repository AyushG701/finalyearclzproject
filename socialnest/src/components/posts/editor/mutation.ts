import {
  InfiniteData,
  QueryFilters,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { submitPost } from "./actions";
import { useToast } from "@/components/ui/use-toast";
import { PostData, PostsPage } from "@/lib/types";
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

// Define the OptimisticPost interface
interface OptimisticPost {
  id: string;
  content: string;
  createdAt: Date;
  userId: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

// Define the MutationContext interface
interface MutationContext {
  previousData: InfiniteData<PostsPage> | undefined;
  tempId: string;
}
function generateId() {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function useSubmitPostMutation() {
  const { user } = useSession(); // Directly using user as per your setup
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation<PostData, Error, string, MutationContext>({
    mutationFn: submitPost,

    onMutate: async (content: string) => {
      const queryKey = ["post-feed", "for-you"];
      await queryClient.cancelQueries({ queryKey } as QueryFilters);

      const previousData =
        queryClient.getQueryData<InfiniteData<PostsPage>>(queryKey);

      const tempId = generateId();

      const optimisticPost: OptimisticPost = {
        id: tempId,
        content,
        createdAt: new Date(),
        userId: user?.id || "unknown",
        user: {
          id: user?.id || "unknown",
          username: user?.username || "Anonymous",
          displayName: user?.displayName || "User",
          avatarUrl: user?.avatarUrl || null,
        },
      };

      queryClient.setQueryData<InfiniteData<PostsPage>>(queryKey, (oldData) => {
        if (!oldData) return oldData;

        const firstPage = oldData.pages[0];
        if (!firstPage) return oldData;

        return {
          ...oldData,
          pages: [
            {
              ...firstPage,
              posts: [optimisticPost as PostData, ...firstPage.posts],
            },
            ...oldData.pages.slice(1),
          ],
        };
      });

      // Return context with previousData and tempId
      return { previousData, tempId };
    },

    onSuccess: (newPost, variables, context) => {
      if (!context) return;

      const queryKey = ["post-feed", "for-you"];
      queryClient.setQueryData<InfiniteData<PostsPage>>(queryKey, (oldData) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page, index) =>
            index === 0
              ? {
                  ...page,
                  posts: page.posts.map((post) =>
                    post.id === context.tempId ? newPost : post,
                  ),
                }
              : page,
          ),
        };
      });

      toast({
        description: "Post created successfully!",
      });
    },

    onError: (error, variables, context) => {
      if (!context) return;

      const queryKey = ["post-feed", "for-you"];
      queryClient.setQueryData(queryKey, context.previousData);

      toast({
        variant: "destructive",
        description: "Failed to post. Please try again.",
      });
    },
  });

  return mutation;
}
