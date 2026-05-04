-- 관리자가 folder_nodes를 관리할 수 있도록 (INSERT, UPDATE, DELETE)
-- 현재는 anon key로 동작하므로 인증된 사용자에게 폭넓게 허용
-- 추후 admin 체크 함수로 강화 가능

CREATE POLICY "folder_nodes_insert_authenticated" ON folder_nodes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "folder_nodes_update_authenticated" ON folder_nodes
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "folder_nodes_delete_authenticated" ON folder_nodes
  FOR DELETE USING (auth.uid() IS NOT NULL);
