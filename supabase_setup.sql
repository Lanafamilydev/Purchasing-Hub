-- Chạy câu lệnh SQL này trong Supabase SQL Editor để tạo bảng lưu trữ PO mẫu:

CREATE TABLE IF NOT EXISTS public.po_tracking_samples (
    po_no TEXT PRIMARY KEY,
    supplier_name TEXT NOT NULL,
    order_date DATE,
    delivery_date DATE,
    status TEXT DEFAULT 'New',
    lines JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tắt RLS (Row Level Security) cho bảng này để cho phép client (Vercel) đọc/ghi bằng Anon Key
ALTER TABLE public.po_tracking_samples DISABLE ROW LEVEL SECURITY;

-- Hoặc nếu muốn bật RLS và cấu hình Policy (Bỏ comment phần dưới nếu muốn dùng RLS):
-- ALTER TABLE public.po_tracking_samples ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow public select" ON public.po_tracking_samples FOR SELECT USING (true);
-- CREATE POLICY "Allow public insert" ON public.po_tracking_samples FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow public update" ON public.po_tracking_samples FOR UPDATE USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow public delete" ON public.po_tracking_samples FOR DELETE USING (true);
