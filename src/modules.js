export const modules = [
 {id:'sentiment',name:'情绪周期',symbol:'∿',load:()=>import('./modules/sentiment/index.js')},
 {id:'capital-radar',name:'实时龙虎榜',symbol:'↗',load:()=>import('./modules/capital-radar/index.js')}
];
