import type {Project} from './types';
export const demoProjects:Project[]=[
{id:'demo-excel',user_id:'demo',title:'تحليل مبيعات متجر باستخدام Excel',description:'مثال توضيحي: عرض الإيرادات الشهرية وتصنيف المبيعات. هذا ليس ملف مستخدم حقيقيًا.',category:'Excel',created_at:'2026-10-01',profiles:{id:'demo',username:'demo',full_name:'حساب توضيحي'}},
{id:'demo-web',user_id:'demo',title:'موقع تعريفي متجاوب',description:'مثال لمشروع برمجي يتضمن صفحة رئيسية ومعرض أعمال.',category:'برمجة',created_at:'2026-10-02',profiles:{id:'demo',username:'demo',full_name:'حساب توضيحي'}}
];
export const categories=['Excel','محاسبة','برمجة','تصميم','لغات','أعمال'];
