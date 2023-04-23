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
	function throwError(wordNum,type,errorMessage,error){//error = str=>Error(str)
		let data = getLineFromWord.get(wordNum);
		let line = lines[data.line-1];
		let whiteSpace = line.match(/^[\t ]*/)?.[0]??"";
		line = line.substr(whiteSpace.length)//[whiteSpace,line]
		throw error(
			"l:"+data.line+" c:"+data.column+"\n"
			+line+"\n"
			+" ".repeat(data.column-1-whiteSpace.length)+"^"+"\n"
			+type+" error"+": "+errorMessage+"\n"
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
		let list = new Lazy();//:list of words
		let context = {finalMap:new Map()};//:Map<String -> Assignment>
		let i=0;
		const getState = ()=>({tree,context,list,i});
		const setState = v=>({tree,context,list,i}=v);
		const stack = [{tree,context,i:0,list}];
		const getWord = i=>tree[i]?.[0]??"";
		class Pattern{
			param;//:(String & word) | Tree<String>
			pattern;//:String? & word
			options;//:String & joined words
		}
		class bracketPattern extends Pattern{
			pattern;//')'|']'|'}'
			list;//:Tree<Pattern> ; brackets only
		}
		const match_pattern = i=>{//Number->String
			let pattern = "";
			let options="";//'()=' '()<=>'
			let param;//:Tree|[String,Number]
			{//assign param
				if("([{".includes(getWord(i))){
					options+=getWord(i)+getWord(i+2);
					param = tree[i+1];
					i+=3;
				}
				else param = tree[i++];
			}
			if(getWord(i)=="?"){options+="?";++i}
			if(getWord(i)==">"){options+=">";++i;}
			else {
				if(getWord(i)=="<"){options+="<";++i}
				if(getWord(i)=="="){pattern="=";options+="=";++i}
				if(getWord(i)==">"){options+=">";++i}
			}
			return {param,pattern,options,i};//`i-1` is to negate the `i++` from the for loop
		};
		const removeIndents=num=>{//removes indentation from strings '""'
			let word = tree[num];
			if(!word.match("\n"))return word;
			let indentNum = (word.match(/\n\s*/g)??[]).reduce((s,v)=>Math.min(s,v.length),Infinity);
			return word.split("\n").reduce((s,v)=>s+v.substr(indentNum));
		};
		for(let i1 = 0; i1<words.length; i1++){
			if(i>=tree.length){
				setState(stack.pop());//`{i} = stack` with `i++` skips the end bracket
				continue;
			}//closeBracket
			let value = tree[i];
			let [word,num] = value;
			let match;
			if((match=match_pattern(i+1)).pattern){
				({i}=match);
				list.push(match);
			}
			else if("([{".includes(word)){
				stack.push(getState());
				context = [];
				tree = tree[i+1];
				i=-1;//next i == 0
			}
			else if(")]}".includes(word)){
				stack[stack.length-1].list.push({pattern:word,list})
				setState(stack.pop());
				//eval labels
			}
			else if(word == ","){({context} = stack[stack.length-1])}
			else {}
		}
		if(false)for(let i1 = 0; i1<words.length; [i1++,i++]){
			if(i>=tree.length){
				setState(stack.pop());//`{i} = stack` with `i++` skips the end bracket
				continue;
			}//closeBracket
			let value = tree[i];
			let [word,num] = value;
			let match;
			if((match=match_pattern(i+1)).pattern){
				({i}=match);
				if(match.pattern == ">"){
					context = [match.param,...context];
					list.push({context,match});
				}
				if(match.pattern == "="){
					context = [match.param,...context];
					list.push({context,match});
				}
			}
			else if("([{".includes(word)){
				stack.push(getState());
				context = [];
				tree = tree[i+1];
				i=-1;//next i == 0
			}
			else if(")]}".includes(word)){
				setState(stack.pop())
				//eval labels
			}
			else if(word == ","){({context} = stack[stack.length-1])}
			else {}
		}
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
	let words = text.match(regex);
	const getLineFromWord=new Map();
	const getWordFromLine=new Map();
	words.reduce((s,v,i)=>{
		s.word = v;
		getLineFromWord.set(i,s);
		getWordFromLine.set(s,i);
		s = {...s};
		if(v.match("\n")){
			s.line += (v.match(/\n/g)?.length??0);
			s.column = 1+(v.match(/.*$/g)?.length??0);
		}
		else s.column+=v.length;
		return s;
	},{line:1,column:1,word:""});
	let tree = treeParse(words);
	let list = text.matchAll(regex);
	let iter = list;//list[Symbol.iterator]();
	return new Lazy(...parse(tree));//new Lazy(...parse());
}
loga(compile(`f>(r>r x>f(r x),a>a a)`));
//loga(Y.call(new Calc((f,n)=>n==0?1:n*f.call(n-1))).call(new Int(4)));
