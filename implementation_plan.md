# Kế hoạch Đồng bộ và Hoàn thiện Giao diện + Tính năng PO Tracking

Đồng bộ toàn bộ chức năng và giao diện của phân hệ **PO Tracking — Hàng Mẫu** từ bản mẫu [F26_Unified_v3.html](file:///c:/Users/namvt.PROPERWELL/Documents/PPW/F26_Unified_v3.html) sang React Web App trong component [POTracking.tsx](file:///c:/Users/namvt.PROPERWELL/Documents/PPW/f26-unified-web/src/components/POTracking.tsx).

## Rà soát các điểm giao diện chưa đạt yêu cầu:
1. **Thanh Tab điều hướng bị vỡ**: Các tab `OverviewListShipmentsImportBáo Cáo` bị dính liền, thiếu icon, khoảng cách, và không có border/active highlight.
2. **Khối KPI KPI Overview bị lỗi style**: Thiếu các khung bao (`card`), màu sắc của text không đúng định dạng.
3. **Bảng dữ liệu bị lỗi CSS**: Chữ bị dính liền, tiêu đề cột co rúm và đè lên nhau, thiếu cấu trúc grid và padding.
4. **Các Modal (Popup) bị lỗi style**: Thiếu lớp phủ mờ (backdrop-filter), bố cục form nhập liệu không chia cột rõ ràng.

---

## Proposed Changes

### 1. Stylesheet

#### [MODIFY] [index.css](file:///c:/Users/namvt.PROPERWELL/Documents/PPW/f26-unified-web/src/index.css)
- Bổ sung toàn bộ hệ thống lớp CSS đặc thù của phân hệ PO Tracking từ bản gốc [F26_Unified_v3.html](file:///c:/Users/namvt.PROPERWELL/Documents/PPW/F26_Unified_v3.html) vào cuối file `index.css`:
  - **PO Tabs**: `.po-stab`, `.po-stab.active`, `.po-stab:hover`
  - **PO KPI Cards**: `.krow`, `.k5`, `.k4`, `.k3`, `.kc`, `.k-lb`, `.k-v`, `.k-s`
  - **PO Detail**: `.dp`, `.dp-hd`, `.dp-title`, `.dp-meta`, `.dp-grid`, `.dp-f`, `.dp-l`, `.dp-v`
  - **Shipment Cards**: `.shpc`, `.shpc-hd`, `.shpc-hd-l`, `.shpc-no`, `.shpc-inv`, `.shpc-bd`, `.shpc-grid`, `.sf-lbl`, `.sf-val`, `.doc-tag`, `.notify-strip`
  - **Stepper / Progress**: `.steps`, `.step`, `.step-d`, `.step-l`, `.prog`, `.pbg`, `.pf`, `.pct`
  - **Badges**: `.bdg`, `.b-ok`, `.b-w`, `.b-d`, `.b-gy`, `.b-bl`, `.b-tl`, `.b-nv`, `.b-vi`, `.b-or`
  - **Import drag&drop area**: `.izone`, `.izone:hover`, `.izone.drag`
  - **Reports Output**: `.rpt-wrap`, `.rpt-hdr`, `.rpt-title`, `.rpt-meta`, `.rpt-kpi`, `.rpt-kc`, `.rpt-kl`, `.rpt-kv`, `.rpt-gh`, `.rpt-gt`, `.rpt-gm`, `.rt`, `.rpt-foot`
  - **Modals & Forms**: `.mb`, `.mb.open`, `.modal`, `.modal-lg`, `.mh`, `.mt`, `.ms`, `.mx`, `.mbody`, `.mfoot`, `.mfr`, `.fsec`, `.fst`, `.fg4`, `.fg2`, `.fg1`, `.ffc`, `.fld`, `.req`, `.lt`

---

### 2. Component Layout & Logic

#### [MODIFY] [POTracking.tsx](file:///c:/Users/namvt.PROPERWELL/Documents/PPW/f26-unified-web/src/components/POTracking.tsx)
- **Topbar & Header**: 
  - Đổi tên các nút trên topbar giống bản gốc: `☁ Sync Cloud` (kết hợp tải & đồng bộ hoặc giữ các nút riêng nhưng style đẹp mắt), `↓ CSV`, `+ New PO` (green/teal background).
- **Navigation Tabs**:
  - Tích hợp thêm icon Lucide bên cạnh text:
    - Tab Overview: `📊 Overview` (dùng `<BarChart2 size={13} />` hoặc `<LayoutDashboard size={13} />`)
    - Tab PO List: `📄 PO List` (dùng `<FileText size={13} />`)
    - Tab Shipments: `🚢 Shipments` (dùng `<Ship size={13} />`)
    - Tab Import: `📥 Import` (dùng `<Download size={13} />`)
    - Tab Reports: `📋 Báo cáo` (dùng `<ClipboardList size={13} />`)
- **Overview Tab**:
  - Sử dụng class `.krow.k5` và cấu trúc thẻ `.kc` để dựng các thẻ KPI đo lường: Total POs, Total Qty, Amount, Overdue, Notify Pending giống bản gốc.
  - Sử dụng các class `.card` và `.tw` bao bọc bảng dữ liệu Overview.
- **PO List & Shipments Tabs**:
  - Dựng lại bảng danh sách PO và danh sách Shipment với checkbox cột đầu tiên, định dạng hiển thị các màu sắc giống bản gốc.
  - Tích hợp thanh bulk action `.bulk-bar` hiển thị khi chọn nhiều dòng.
- **Modals (Detail, Edit PO, Edit Shipment, Email)**:
  - Cập nhật cấu trúc thẻ modal sử dụng các class `.mb`, `.modal`, `.mh`, `.mt`, `.mbody`, `.mfoot`... để có lớp phủ mờ blur backdrop đẹp mắt và bố cục form chia cột đều đặn.

---

## Verification Plan

### Manual Verification
1. Kiểm tra giao diện các tab điều hướng xem đã hiện đúng icon và khoảng cách chưa.
2. Kiểm tra các KPI cards xem đã căn lề grid 5 cột và hiển thị đúng style/màu sắc chưa.
3. Kiểm tra các bảng dữ liệu xem chữ đã được giãn cách đúng padding, không bị tràn hay co rúm.
4. Mở các Modal (Detail, Edit PO, Edit Shipment) xem backdrop mờ và form hiển thị có cân đối không.

### Build Verification
- Chạy `npm run build` để kiểm tra lỗi TypeScript/Vite đóng gói.
