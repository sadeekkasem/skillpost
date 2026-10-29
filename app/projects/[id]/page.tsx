import Detail from '@/components/ProjectDetail';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <Detail id={id}/>}
