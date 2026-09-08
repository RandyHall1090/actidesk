-- Same PUBLIC-default-grant gotcha as handle_new_user/is_org_admin before
-- it: this is a trigger-only function, never meant to be called directly.
revoke execute on function public.prevent_self_role_escalation() from public;
