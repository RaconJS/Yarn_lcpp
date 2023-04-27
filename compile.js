//classes
	//Exp: Lambda'λ' | Lazy'()' | Recur'::'
	//OutExp: Lazy
	function findHighestContext(list){//list:Exp[]
		return list.reduce((s,v)=>Math.max(s,typeof v=="number"?v:s.findHighestContext()),-1);
	}
	class Exp{
		call(arg,context,stack){return arg}
		eval(){return this}
	}
	class Lazy extends Array{//:Exp ; lazy evaluation
		//Lazy : Exp[]
		context;//:Context
		recur=1;//:Number|Int
		findHighestContext(){
			return this.highestContext?this.highestContext:
				findHighestContext(this);
		}
		constructor(...exps){
			super(exps.length);
			Object.assign(this,exps);
		}
		call(arg=undefined,context=undefined,stack=[]){//(arg:Lazy,Stack)->Lazy
			if(this.length == 1 && this[0] instanceof Lambda)return this[0].call(arg,this.context,stack);
			return this.eval(stack).call(arg);
		}//(a>a)(a>a a)
		eval(stack=[]){
			const context = this.context;
			return this.map(v=>//[]->{call:(arg:Lazy,Stack)->Combinator|Lazy&{call:(Exp,Context,Stack)->Lazy}}[]
				typeof v == "number"?context.getValue(v):
				typeof v == "string"?v://simple raw string cannot be called
				//typeof v == "string"?:
				v instanceof Int?v:
				v instanceof Lambda?Object.assign(new Lazy(v),{context}):
				v instanceof Lazy?v:
				v instanceof RecurSetter?Object.assign(new Lazy(v.exp),{context,recur:+this.toInt(v.recur)??0}):
				v instanceof NameSpace?v:
				v instanceof Array?Object.assign(new Lazy(...v),{context}):
				typeof v.call == "function"?v:
				v instanceof Object?(v=>{
					let labels={};
					for(let i in v){
						labels[i]=new Lazy(v[i])
					}
					return new NameSpace(labels);
				})(v):
				v//uncallable object
			).reduce((s,v)=>
				s.call(v,context,stack)
			)
		}
		toInt(foo){//foo:{call(inc)->{call(0)->Number}}
			if(foo instanceof Int)return foo;
			const inc = x=>x instanceof Int?new Int(x+1):new Lazy(Int.increment)
			const zero = new Int(0);
			return foo.call(inc).call(zero);
		}
	}
	class Context{
		static null;//:Context
		constructor(parent,argument){
			Object.assign(this,{
				parent,//:Context?
				argument,//:Lazy|{String->Lazy}|Lazy[]
			});
			this.chainLen=(parent?.level??-1)+1;//:Number
		}
		getValue(num){
			let context = this;
			for(let i=0;i<num;i++){
				context = context.parent;
			}
			return context.argument;
		}
	}
	Context.null = new Context();
	function stackCheck(stack){
		if(1)return true;
		let counts=[];
		let numMap = stack.reduce((s,v,i)=>s.has(v)?s.set(v,i):s,new Map())//Map(Exp,Number)
		let recurs = [];
		numStack = stack.map(v=>
			(int=>{
				counts[int]??=0;
				counts[int]++;
				if(counts[int]>1)recurs.push()
				return int
			})(numMap.get(v))
		);
		for(let i of numStack){
		}
		let recursions=[];
	}
	//code:
		class Lambda extends Array{//:Exp
			constructor(...exps){
				super(exps.length);
				Object.assign(this,exps);
			}
			static null = new Lambda(0);
			findHighestContext(){
				return this.highestContext?this.highestContext:
					findHighestContext(this);
			}
			call(arg,context=new Context(),stack){
				context = new Context(context,arg);
				let recur = arg instanceof Lazy?arg.recur:1;
				return Object.assign(new Lazy(...this),{context,recur}).eval();
			}
		}
		class Assignment{
			constructor(labelName,value,parent){//:(String,ContextTree) 'a = 2'
				Object.assign(this,{labelName,value,parent});
			}
		}
		class RecurSetter extends Exp{//:Exp
			constructor(exp,recur){
				Object.assign(this,{
					exp,//:Context?
					recur,
				});
			}
			findHighestContext(){
				return this.highestContext?this.highestContext:
					Math.max(findHighestContext(this.exp),findHighestContext(this.recur));
			}
		}
		class NameSpace extends Exp{//'{a b c}' and '{a<=1,b<=2,c<=3}'
			constructor(labels,lazy){
				this.labels = labels;
				this.lazy = lazy;
			}
			labels;//labels:{[String]:Lazy}
			lazy;//:lazy ()
			call(arg,context,stack){
				if(this.lazy)return this.lazy.call(arg,context,stack);//{a>a a} x -> (a>a a) x
				if(arg instanceof NameSpace)return new NameSpace({...this.labels,...arg.labels},arg.lazy);
				else return arg.call(this);
			}
		}
		class Dot{
			call(){

			}
		}
	class Int extends Number{
		constructor(value){
			super(value|0);
		}
		static Part1 = class extends Lazy{
			constructor(value,arg_f){
				super();
				this.value = value;//:Number|Int
				this.foo = arg_f;//:Lazy
			}
			call(arg_x){
				let ans = arg_x;
				for(let i = 0;i<this.value;i++){
					ans = this.foo(ans);
				}
				return ans;
			}
			eval(){return this}
		};
		static increment = {
			//n> f>x>f(n f x)
			call(arg){return(arg|0)+1??arg.call(this.lazyExpVersion)},
			lazyExpVersion:new Lambda(new Lambda(new Lambda(1,[2,1,0]))),
		};
		call(arg_f){//f>x>
			return new Part1(this,arg_f);
		}
		eval(){return this}
	}
	class Calc{//calculation
		constructor(func,args=[]){
			this.func=func;
			this.args = args;
			if(args.length>=func.length){
				const ans = this.func(...args);
				return isNaN(ans)?Lambda.null:new Int(ans);
			}
			//func:(...Number[])->Number
		}
		args;//:Lazy[]
		call(arg){//Int->Int-> ... Int-> Int
			return new this.constructor(this.func,[...this.args,arg])
		}
		eval(){return this}
	}
	class Func{//arraw function
		constructor(func){
			this.func=func
		}
		call(arg){//Int->Int-> ... Int-> Int
			return this.func(arg);
		}
		eval(){return this}
	}
	class List extends Array{

	}
	//ints
	//f>x>f (x x)

	//f>(a>a a)x>f a a=x x
	//const Y = new Lambda(new Lambda(0,0),new Lambda(new Lambda(2,0),[0,0]));
	let Y = new Lambda(new Lambda(1,[0,0]),new Lambda(1,[0,0]));
	let vec2 = new Lambda(new Lambda({x:1,y:0}));//x>y>{x y}
	let recur = new Lambda();
//----
function loga(...logs){console.log(...logs)}
function compile (text){
	//types
		//syntax, reference
	let TEST = false;
	function throwError(wordNum,type,errorMessage,error){//error = str=>Error(str)
		//note: lines and colums are counted from 1
		let data = getLineFromWord.get(wordNum);
		let line = lines[data.line-1];
		let whiteSpace = line.match(/^[\t ]*/)?.[0]??"";
		line = line.substr(whiteSpace.length)//[whiteSpace,line]
		if(!TEST)error=a=>a;
		let lineLen = (""+data.line).length;
		throw error(
			"lc++ ERROR:\n"
			//"l:"+data.line+" c:"+data.column+"\n"
			// " ".repeat(lineLen)+" |\n"
			+data.line          +" |" +line+"\n"
			+" ".repeat(lineLen)+" |" +" ".repeat(data.column-1-whiteSpace.length)+"^".repeat(words[wordNum].length)+" "+type+" error\n"
			+"error"+": "+errorMessage+"\n"
		);
	}
	function treeParse(words){
		let list = [];
		let stack = [];
		for(let i=0;i<words.length;i++){
			let word = words[i];
			let value = [word,i];
			if(word.match(/[(\[{]/)){
				stack.push(list);
				list.push(value,list = []);
			}
			else if(word.match(/[)\]}]/)){
				list = stack.pop();
				if(!list)throwError(i,"syntax", "unballanced brackets: Too many closing brackets", a=>Error(a));
				//assert: list[list.length-2] exists
				let openBracket = list[list.length-2][0];
				if(({"(":")", "[":"]", "{":"}"})[openBracket]!=word)throwError(i,"syntax", "unmatching brackets:'"+openBracket+"..."+word+"'", a=>Error(a));
				list.push(value);
			}
			else list.push(value);
		}
		if(stack.length>0)throwError(i,"syntax", "unballanced brackets: Too many opening brackets", a=>Error(a));
		return list;
	}
	function parseContexts(tree){
		//classes & consts
			const numberRegex = /^[0-9]+$/;
			const getWord = (tree,i)=>tree[i]?.[0]??"";
			class Pattern{
				constructor(data){
					Object.assign(this,data)
					if(this.list){//if this has own context
						Object.assign(this.list,{

						})
					}
				}
				id;//:[]SyntaxTree
				type="operator";//:"operator"|"word"|"number"|"symbol"|"function"|"assignment"
				parent;//:BracketPattern
				isFirst;//:bool ; Is true if this is the start of a list, or can be used as the starting function.

				//optionals
					pattern;//:?String & word
					options;//:?String & joined words
					params;//:?(String & word) | Tree<String>
					list;
			}
			class Simple extends Pattern{
				constructor(data){super();Object.assign(this,data)}
				//pattern:undefined;
				set parent(v){this.#parent=v}
				get parent(){return this.#parent}
				#parent;
				arg;//:String
				value;//:Param?
				type;
			}
			class BracketPattern extends Pattern{
				constructor(data){super();Object.assign(this,data)}
				parent;
				pattern=')';//')'|']'|'}'
				list=[];//:Tree<Pattern> ; brackets only
			}
			class Pattern_extra{
				startLabels;//:Map(String,Ref)
				currentLabels;//:Map(String,Ref)
				refs;//:Set(Pattern) & Tree(Pattern)
				refLevel;//:Number
			};
			class Param{
				constructor(data){Object.assign(this,data)}
				name;//:[String,Number] ; name of the parameter or label
				index;//:number ; if a pattern has muli parameters it shows which one it is.
				owner;//: Pattern & context with a {list:Array} ; is the expression that the label bellongs to
			}
			const comma = {};
		//----
		const match_pattern_arg = ({tree,i,pattern})=>{//'a' or '$1' 
			let oldI=i;
			let getObj = ()=>({i,id:tree[oldI][1],type:"argument"});
			if(!pattern){
				let word;
				if((word=getWord(tree,i))=="$"){
					pattern = "$";
					++i;
					if(getWord(tree,i).match(numberRegex)){
						params = [tree[i]];
						++i;
					}
					else {i=oldI;pattern = ""}
					return new Pattern(getObj())
				}
				else if(word.match(/^\w+$/)){
					pattern = word;
					i++;
					let match = new Simple({...getObj(),arg:word});
					if(word.match(numberRegex))match.type="number";
					return match;
				}
			}
			return ;
		}
		const match_pattern = (tree,i)=>{//Number->String
			//note: If there's no pattern property, then no pattern was found and the object is disguarded.
			let id = tree[i][1];
			let pattern = "";
			let options="";//'()=' '()<=>'
			let params=[];//:Tree|[String,Number]
			let hasOwnContext=false;
			let type="operator";
			let oldI=i;
			if(!pattern){
				let word = getWord(tree,i);
				if(word=="<"){
					++i;
					if(getWord(tree,i).match(/\w+/)){
						pattern = "<";
						params = [tree[i]];
						++i;
					}
					if(getWord(tree,i)){

						++i;
					}
				}
				//if(getWord(tree,i+1)=="::"){} UNFINISHED
			}
			if(!pattern){//function and assignment | 'with' block | 'use' block
				i=oldI;
				hasOwnContext=true;
				{//assign params
					if("([{".includes(getWord(tree,i)||undefined)){
						options+=getWord(tree,i)+"..."+getWord(tree,i+2);
						let forEachSyntaxTree=tree=>(foo,s0)=>{
							let s = s0;
							return function traverse(foo,tree){
								for(let i=0;i<tree.length;i++){
									if("([{".includes(tree[i][0])){
										traverse(foo,tree[++i]);
										i++;
									}
									else{
										s=foo(tree[i],i,tree)
									}
								}
							}
						};
						params = [];// [a b c] = 
						tree[i+1].forEach((v,i,word)=>typeof(word=getWord(tree,i))=="string" && !"()[]{}".includes(word)?params.push(word):0);
						i+=3;
					}
					else params = [tree[i++]];
				}
				if(getWord(tree,i)=="?"){options+="?";++i}
				if(getWord(tree,i)==">"){options+=pattern=">";++i;type="function";}
				else {
					if(getWord(tree,i)=="<"){options+="<";++i}
					if(getWord(tree,i)=="="){options+=pattern="=";++i;type="assignment";}
					if(getWord(tree,i)==">"){options+=">";++i}
				}
				if(options.includes("(")&&pattern){//()> or ()=
					pattern = "()=";//use and with blocks are counted as with blocks
					type = "with";//{">"}[options.match(/(?<=\)).*$/)];
				}
			}
			if(!pattern){
				i=oldI;
				let match = match_pattern_arg ({tree,i});
				if(match)return match;
			}
			let match = new Pattern({pattern,options,params,id,type,...(hasOwnContext?{list:[]}:{}),i});
			if(params)match.params.forEach((v,i,a)=>a[i]=new Param({name:v,index:i,owner:match}));
			return match;
		}
		const removeIndents=num=>{//removes indentation from strings '""'
			let word = tree[num];
			if(!word.match("\n"))return word;
			let indentNum = (word.match(/\n\s*/g)??[]).reduce((s,v)=>Math.min(s,v.length),Infinity);
			return word.split("\n").reduce((s,v)=>s+v.substr(indentNum));
		};
		let context = new BracketPattern;
		let patterns = {
			list:[...(function* getPatterns(tree,bracketContext){
				let context = bracketContext;
				let word;
				let isFirst=true;
				tree = tree.filter((v,i)=>!getWord(tree,i)?.match?.(/^(\s*|\/\*[\s\S]*\*\/|\/\/.*)$/));
				for(let i=0;i<tree.length;isFirst=false){
					word = getWord(tree,i);
					let match = match_pattern(tree,i);
					if(match.pattern||(match instanceof Simple)){
						({i}=match);
						match.parent = context;
						context.list.push(match);
						match.isFirst=isFirst;
						if(match.list){
							context=match;
							isFirst=true;
						}
						yield match;
						continue;
					}
					else if("([{".includes(getWord(tree,i))){
						++i;
						let bracket=new BracketPattern({pattern:"()",list:[],parent:context,isFirst});
						yield bracket;
						context.list.push(bracket);
						yield*getPatterns(tree[i],bracket);
						++i;
					}
					else if(")]}".includes(word)){
						return;
					}
					else if(word == ","){
						//yield comma;
						//context.push(comma);
						context = bracketContext;
						isFirst=true;
					}
					else {
						let match = new Simple({id:tree[i][1],arg:word,type:"symbol",parent:context,isFirst})
						yield match;
						context.list.push(match);
					};
					i++
				}
			}(tree,context))],
			context
		};
		function* forEachTree(context,isTree){//isTree:node->Tree?
			for(let i=0;i<context.list.length;i++){
				let [v,a] = [context.list[i],context];
				yield [v,i,a];
				if(isTree(v))yield*forEachTree(v,isTree);
			}
		}
		patterns.forEach = forEachPattern;
		const forEachPattern = ()=>forEachTree(context,v=>v?.list);
		function addRefParam(match,match_parents,param){
			//match:Pattern
			//match_parents:Set(BracketPattern)
			//param:Param
			let higherParamParent = param.owner;//:Pattern
			let argParentIndex;
			//assume: there is not an infinite chain of Pattern.parent's
			while(
				higherParamParent
				&& -1 == (argParentIndex = match_parents.indexOf(higherParamParent.parent))
			){higherParamParent = higherParamParent?.parent};
			if(argParentIndex==-1)throw Error("compiler error");
			if(!higherParamParent)throw Error("compiler error");
			let higherArgParent = match_parents[argParentIndex-1];
			if(!higherArgParent)throw Error("compiler error");
			if(higherParamParent.parent!=higherArgParent.parent)throw Error("compiler error");
			{//check for and prevent reference loops
				if(higherParamParent.refs?.has?.(higherArgParent))throwError(match.id,"illegal reference","recursive/self reference, detected using label '"+match.arg+"'. These are not allowed",a=>Error(a))
			}
			//note:
				//From now on only things from block 'arg' can reference block 'param'
				//and never the other way around.
				//Otherwise a reference error is thrown.
			//----
			//adds new reference.
			if(!higherArgParent.refs){
				higherArgParent.refs=new Set;//:Set(Pattern)
				higherArgParent.refLevel??=(higherParamParent.refLevel??-1)+1;
				higherParamParent.refLevel??=higherArgParent.refLevel-1;
			}
			if(higherArgParent.refLevel<=higherParamParent.refLevel)throwError(match.id,"illegal reference","complex recursive/self reference, detected using label '"+match.arg+"'. These are not allowed",a=>Error(a));
			higherArgParent.refs.add(higherParamParent);
		}
		function getParam(name,parent,parents){//parents:Pattern[]?
			let param = 
				parent?.currentLabels?.get?.(name)
				??parent?.startLabels?.get?.(name)
			;

			//loga(match.parent.parent.startLabels.get("a"))
			parents?.push?.(parent);
			return param?
				{param,parents}:
				parent.parent?
					getParam(name,parent.parent,parents)
					:undefined
			;
		}
		(function getAssignments(patterns){
			for(let [match,i,bracketParent] of forEachPattern()){
				let lastValue = match.isFirst?undefined:bracketParent[i-1];// ','
				if(match.pattern == "="){//assignment
					//assume: bracketParent == match.parent
					let startLabels=bracketParent.startLabels;
					if(!startLabels){//set up assignment properties
						bracketParent.startLabels = startLabels = new Map();//String|Number => Param
						bracketParent.currentLabels = new Map();
						bracketParent.refs = new Set();//:Set(BracketPattern) where p.refs.get(x).refs.get(p) == undefined
					}
					let i=0;
					for(let param of match.params){//param:Param
						if(!startLabels.has(param))startLabels.set(param.name[0],param);
					}
				}
			}
			for(let [match,i,bracketParent] of forEachPattern()){
				let lastValue = match.isFirst?undefined:bracketParent[i-1];// ','
				if(match.pattern == "="){//assignment
					for(let param of match.params){
						match.parent.currentLabels.set(param.name[0],param);
					}
				}
				else if(match.type == "argument"){
					if(match.pattern == "$"){}
					else{
						let {param,parents} = getParam(match.arg,match.parent,[])??{};
						if(!param)throwError(match.id,"reference","label: '"+match.arg+"' is undefined",a=>Error(a));
						addRefParam(match,parents,param);
						//if(parent)
						match.value = param;
					}
				}
			}
		}(patterns.list));
		return context;
	}
	function parse(tree,list=new Lazy(),context=[],startI=0){
		const startList = list;
		for(let i = startI;i<tree.length;i++){
			let value = tree[i];
			let [word,num] = value;
			if(word.match(/^\/\/|^\/\*|\s+/)){}//ignore comments & white space
			else if(word.match(/[([{]/)){
				let i1 = i+3;
				let isMut = tree[i1]?.[0]=="?";
				if(isMut)i1++;
				let word1= tree[i1]?.[0]??"";
				if(word1.match(/=|>/)){
					if(word1.match("=")){//with'()=' or destructor assign '[]=','{}='
					}
					else if(word1.match("=")){//using'()>' or destructor param '[]>','{}>'
					}
				}
				else {
					switch (word){
						case "(":list.push(parse(tree[i+1],Object.assign(new Array(),{id:num}),context));break;
						case "[":;break;
						case "{":;break;
					}
				}
				i+=2;
			}
			else if(word.match(/[)\]}]/))break;
			else if(context.indexOf(word)!=-1){
				list.push(context.indexOf(word));
			}
			else if(word.match(/^["]/)){
				list.push(word.match(/(?<=^.)[\s\S]*(?=.$)/)[0]);
			}
			else if(word=="λ"){
				context = [{},...context];
				list.push(list = new Lambda());
			}
			else if(word.match(/^[0-9]+$/)){
				list.push(new Int(+word));
			}
			else if(word==","){
				startList.push(list=[]);
			}
			else if(word=="::"){
				throw Error("recursion setting '::' is not supported")
				//startList.push(new RecurSetter(,list=new Lazy()));
			}
			else if((tree[i+1]?.[0]??"")[0]==">"){
				context = [word,...context];
				list.push(list = Object.assign(new Lambda(),{id:num}));
				i++;
			}
		}
		let outList = startList;
		if(list.length == 0&&list!=startList)startList.pop();
		if(startList.length==1)outList = outList[0];
		return outList;
	}
	let regex =/[λ]|\b\w+\b|"[^"]*"|[^\s]|\s+|\/\/.*|\/\*[\s\S]*\*\//g;
	let lines = text.split("\n");
	const words = text.match(regex);
	const getLineFromWord=new Map();
	const getWordFromLine=new Map();
	words.reduce((s,v,i)=>{
		s.word = v;
		getLineFromWord.set(i,s);
		getWordFromLine.set(s,i);
		s = {...s};
		if(v.match("\n")){
			s.line += (v.match(/\n/g)?.length??0);
			s.column = (v.match(/.*$/g)?.length??0);//assume: column >= 1
		}
		else s.column+=v.length;
		return s;
	},{line:1,column:1,word:""});
	try{//main
		const tree = treeParse(words);
		const context = parseContexts(tree);
		return context;//parse(tree);
	}catch(error){
		console.log(error);
	}
}
//loga
(compile(`a=b,b=c,c=d,d=a`))//f>(r>r x>f(r x),a>a a)`));
//loga(Y.call(new Calc((f,n)=>n==0?1:n*f.call(n-1))).call(new Int(4)));
