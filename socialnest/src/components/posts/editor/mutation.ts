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

interface MutationContext {
  previousData: Map<string[], InfiniteData<PostsPage> | undefined>;
  tempId: string;
}

function generateId() {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function useSubmitPostMutation() {
  const { user } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation<PostData, Error, string, MutationContext>({
    mutationFn: submitPost,

    onMutate: async (content: string) => {
      const queryFilter = {
        queryKey: ["post-feed"],
        predicate: (query: any) =>
          query.queryKey.includes("for-you") ||
          (query.queryKey.includes("user-posts") &&
            query.queryKey.includes(user.id)),
      } as QueryFilters;

      await queryClient.cancelQueries(queryFilter);

      const previousData = new Map<
        string[],
        InfiniteData<PostsPage> | undefined
      >();
      const matchingQueries = queryClient.getQueriesData(queryFilter);

      matchingQueries.forEach(([queryKey, data]) => {
        previousData.set(queryKey as string[], data as InfiniteData<PostsPage>);
      });

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

      matchingQueries.forEach(([queryKey]) => {
        queryClient.setQueryData<InfiniteData<PostsPage>>(
          queryKey,
          (oldData) => {
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
          },
        );
      });

      return { previousData, tempId };
    },

    onSuccess: (newPost, variables, context) => {
      if (!context) return;

      const queryFilter = {
        queryKey: ["post-feed"],
        predicate: (query: any) =>
          query.queryKey.includes("for-you") ||
          (query.queryKey.includes("user-posts") &&
            query.queryKey.includes(user.id)),
      } as QueryFilters;

      const matchingQueries = queryClient.getQueriesData(queryFilter);

      matchingQueries.forEach(([queryKey]) => {
        queryClient.setQueryData<InfiniteData<PostsPage>>(
          queryKey,
          (oldData) => {
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
          },
        );
      });

      toast({
        description: "Post created successfully!",
      });
    },

    onError: (error, variables, context) => {
      if (!context) return;

      context.previousData.forEach((data, queryKey) => {
        queryClient.setQueryData(queryKey, data);
      });

      toast({
        variant: "destructive",
        description: "Failed to post. Please try again.",
      });
    },
  });

  return mutation;
}
