export type Profile = {
  id: string;
  username: string;
  full_name: string;
  bio: string;

  role?: "member" | "admin" | null;
  avatar_path?: string | null;
  specialty?: string | null;
  website_url?: string | null;
  linkedin_url?: string | null;
  contact_email?: string | null;
};

export type ProjectAuthor = Pick<
  Profile,
  "id" | "username" | "full_name" | "avatar_path" | "specialty"
>;

export type Attachment = {
  id: string;
  project_id: string;
  owner_id: string;
  path: string;
  name: string;
};

export type Project = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  created_at: string;
  profiles?: ProjectAuthor | null;
  attachments?: Attachment[];
};

export type Comment = {
  id: string;
  user_id?: string;
  content: string;
  created_at: string;
  profiles?: {
    username: string;
    full_name: string;
  } | null;
};

export type FriendshipStatus =
  | "none"
  | "friends"
  | "request_sent"
  | "request_received";

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
  created_at: string;
  updated_at: string;
};
export type PostAuthor = Pick<Profile, "id" | "username" | "full_name" | "avatar_path">;

export type PostComment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: PostAuthor | null;
};

export type Post = {
  id: string;
  user_id: string;
  content: string;
  image_path: string | null;
  created_at: string;
  updated_at?: string;
  profiles?: PostAuthor | null;
  post_likes?: { user_id: string }[];
  post_comments?: PostComment[];
};
