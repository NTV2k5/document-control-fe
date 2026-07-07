import { Link } from '@tanstack/react-router';
import { BookOpen, ChevronRight } from 'lucide-react';
import { getTemplateVariableDocHref, getTemplateVariableDocsByCategory } from '../../lib';

export const TemplateVariableDocsPage = () => {
  const categories = getTemplateVariableDocsByCategory();
  const docs = categories.flatMap((category) =>
    category.docs.map((doc) => ({ ...doc, categoryLabel: category.label })),
  );

  return (
    <div className="p-6">
      <div className="mb-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#0B2559]">
          <BookOpen className="size-4" />
          Docs biến mẫu
        </div>
        <h1 className="mt-1 text-3xl font-bold text-[#0B2559]">Docs cấu hình biến mẫu</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Danh sách tài liệu cấu hình variable. Thêm docs mới bằng file HTML trong{' '}
          <span className="font-mono text-slate-700">public/docs</span> và đăng ký trong registry.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-4 py-3">Tài liệu</th>
              <th className="border-b border-slate-200 px-4 py-3">Nhóm</th>
              <th className="border-b border-slate-200 px-4 py-3">Tags</th>
              <th className="w-28 border-b border-slate-200 px-4 py-3 text-right">Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.id} className="border-b border-slate-100 last:border-b-0 hover:bg-blue-50/40">
                <td className="px-4 py-4">
                  <div className="font-semibold text-slate-950">{doc.title}</div>
                  <div className="mt-1 text-sm text-slate-500">{doc.description}</div>
                </td>
                <td className="px-4 py-4">
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    {doc.categoryLabel}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    {doc.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-4 text-right">
                  <Link
                    to={getTemplateVariableDocHref(doc.id) as never}
                    className="inline-flex items-center gap-1 font-semibold text-[#0B2559] hover:text-blue-700">
                    Mở
                    <ChevronRight className="size-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {docs.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">Chưa có tài liệu nào được đăng ký.</div>
        ) : null}
      </div>
    </div>
  );
};
