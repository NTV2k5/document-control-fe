import { ArrowLeft, BookOpen, FileQuestion } from 'lucide-react';
import { Button } from 'reactjs-platform/ui';
import { getTemplateVariableDocById, getTemplateVariableDocHref, getTemplateVariableDocsByCategory } from '../../lib';

type TTemplateVariableDocViewerPageProps = {
  docId: string;
};

export const TemplateVariableDocViewerPage = ({ docId }: TTemplateVariableDocViewerPageProps) => {
  const doc = getTemplateVariableDocById(docId);
  const categories = getTemplateVariableDocsByCategory();

  if (!doc) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 px-6">
        <div className="max-w-lg rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-slate-100 text-slate-600">
            <FileQuestion className="size-6" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-950">Không tìm thấy tài liệu</h1>
          <p className="mt-2 text-sm text-slate-500">
            Docs id <span className="font-mono text-slate-700">{docId}</span> chưa được đăng ký trong cấu hình docs.
          </p>
          <Button asChild className="mt-6" variant="outline">
            <a href="/template-variable-docs">Về danh sách docs</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-[calc(100vh-4rem)] bg-slate-100 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="border-b border-slate-200 bg-white px-4 py-5 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:overflow-auto lg:border-b-0 lg:border-r">
        <Button asChild className="-ml-3 mb-4 text-slate-500" variant="ghost">
          <a href="/template-variable-docs">
            <ArrowLeft className="size-4" />
            Tất cả docs
          </a>
        </Button>

        <div className="flex items-center gap-2 text-sm font-bold text-[#0B2559]">
          <BookOpen className="size-4" />
          Docs biến mẫu
        </div>

        <nav className="mt-5 grid gap-5">
          {categories.map((category) => (
            <div key={category.id}>
              <div className="px-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{category.label}</div>
              <div className="mt-2 grid gap-1">
                {category.docs.map((item) => {
                  const is_active = item.id === doc.id;

                  return (
                    <a
                      key={item.id}
                      href={getTemplateVariableDocHref(item.id)}
                      className={[
                        'rounded-md px-3 py-2 text-sm font-medium transition',
                        is_active
                          ? 'bg-[#0B2559] text-white'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
                      ].join(' ')}>
                      {item.title}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0B2559]">
              <BookOpen className="size-4" />
              {doc.badge}
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">{doc.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{doc.description}</p>
          </div>
        </header>

        <iframe title={doc.title} src={doc.url} className="min-h-[calc(100vh-105px)] w-full flex-1 border-0 bg-white" />
      </div>
    </div>
  );
};
