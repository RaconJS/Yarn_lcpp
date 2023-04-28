//TEST
//UNTESTED
//TODO
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
		call(arg=undefined,context=undefined,stack=new Stack()){//(arg:Lazy,Stack)->Lazy
			//let v = this;
			//if(v!=this)v.call(arg,this.context,stack);
			if(this.length == 1 && this[0] instanceof Lambda)return this[0].call(arg,this.context,stack);
			return this.eval(stack).call(arg);
		}//(a>a)(a>a a)
		eval(stack=new Stack()){
			const context = this.context;
			if(this.length==0)return Lambda.null;
			//note this.map first calls 'new Lazy(this.length)' which is overwriten if there is at least 1 item in the expression.
			let ans = this.map(v=>//[]->{call:(arg:Lazy,Stack)->Combinator|Lazy&{call:(Exp,Context,Stack)->Lazy}}[]
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
			);
			if(ans instanceof Lazy){
				while(ans.length == 1 && ans[0] instanceof Lazy ||(!("call" in (ans[0]??{})) && ans[0] instanceof Array))ans=ans[0];//assume: is Tree
				//ans:Lazy|Array
				if(ans.length == 0)ans = Lambda.null;
			}
			return ans;
		}
		toInt(foo){//foo:{call(inc)->{call(0)->Number}}
			return this.constructor.toInt(foo);
		}
		static toInt(foo){//foo:{call(inc)->{call(0)->Number}}
			if(foo instanceof Int)return foo;
			const inc = Int.increment;
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
	class Stack extends Array{
		constructor(...exps){
			super(exps.length);
			Object.assign(this,exps);
		}
		add(lambda){
			let id = lambda.id;
			if(id!=undefined){
				this.unshift(id);
			}
			let isValid = this.stackCheck();
			if(!isValid)this.shift();
			return isValid;
		}
		remove(){
			this.shift();
		}
		stackCheck(){//only checks last item
			let id = this.shift();
			let lastId=this.indexOf(id);
			this.unshift(id);
			if(lastId==-1)return true;
			for(let i=lastId+1;i<this.length;){
				let isMatch=true;
				if(this[i]!=id){i++;continue}
				else i++;
				if(i+lastId>this.length){return true}
				if(lastId==0){return false}
				else for(let i1=0;i1<lastId;[i1++,i++]){
					if(this[i]!=this[i1+1]){isMatch=false;break;}
				}
				if(isMatch)return false;
			}
			return true;
		}
	}
	let p = 4;
	loga(0?new Stack(1,0,0,1).stackCheck():
		//2,4,10
		//1,3,6,12,18,30,36,36,36,18,0
		//1,4,12,36,96,264,672,1680,4080,9480,21312,46296
		//new Array(11).fill().map((v,i)=>
			new Array(p**4)
			.fill()
			.map(
				(v,i,a)=>
					(a.length+i).toString(p)
					.substr(1)
					.split("")
					.map(v=>+v)
			)
			.reduce(
				(s,v)=>
				s?s:[v,
				//0?new Stack(...v).stackCheck():
				v.reduce(
					(s,v,i,a)=>
						!s?s:new Stack(
							...[...a].splice(a.length-1-i,i+1)
						).stackCheck()
					,true
				)][1]
				,false
			)
			//.reduce((s,v)=>s+v[1],0)
		//).join(",")
	)
	//code:
		class Lambda extends Array{//:Exp
			constructor(...exps){
				super(exps.length);
				Object.assign(this,exps);
			}
			id;//:number
			static null = new class Null{
				call(arg){return arg}
				eval(){return this}
			};
			findHighestContext(){
				return this.highestContext?this.highestContext:
					findHighestContext(this);
			}
			call(arg,context=new Context(),stack=new Stack()){
				stack.add(this);
				context = new Context(context,arg);
				let recur = arg instanceof Lazy?arg.recur:1;
				let ans = Object.assign(new Lazy(...this),{context,recur}).eval();
				stack.remove(this);
				return ans;
			}
			eval(){return this}
			toJS(){
				return function(arg){return this.call(arg)}.bind(this);
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
			constructor(labels,lazy){//labels:json-like object
				this.labels = new Map(...function*(obj){for(let i in obj)yield [i,obj[i]]}(labels));
				this.lazy = lazy;
			}
			labels;//labels:Map([String],Lazy)
			lazy;//:lazy ()
			call(arg,context,stack){
				if(this.lazy)return this.lazy.call(arg,context,stack);//{a>a a} x -> (a>a a) x
				if(arg instanceof NameSpace)return new NameSpace({...this.labels,...arg.labels},arg.lazy);
				else return arg.call(this);
			}
			eval(){return this}
		}
		class Dot{//'a.b'
			constructor(name){
				this.name=name;//:String
			}
			call(arg,context,stack){
				if(arg instanceof NameSpace)return arg.labels
			}
			eval(){return this}
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
			call(arg_x,context,stack){
				let ans = arg_x;
				for(let i = 0;i<this.value;i++){
					ans = this.foo.call(ans,context,stack);
				}
				return ans;
			}
			eval(){return this}
		};
		static increment = {
			//n> f>x>f(n f x)
			call(arg){return new Int((arg|0)+1)??arg.call(this.lazyExpVersion)},
			lazyExpVersion:new Lambda(new Lambda(new Lambda(1,[2,1,0]))),
		};
		call(arg_f){//f>x>
			return new this.constructor.Part1(this,arg_f);
		}
		eval(){return this}
	}
	class Calc{//calculation
		constructor(func,args=[]){
			this.func=func;
			this.args = args;
			if(args.length>=func.length){
				const ans = this.func(...args.map(v=>Lazy.toInt(v)));
				return isNaN(ans)?Lambda.null:new Int(ans);
			}
			//func:(...Number[])->Number
		}
		args;//:Lazy[]
		//isOperater:bool&Operator?
		call(arg){//Int->Int-> ... Int-> Int
			return new this.constructor(this.func,[...this.args,arg])
		}
		eval(){return this}
	}
	class Func{//arraw function
		constructor(func){
			this.func=func
		}
		//isOperater:bool&Operator?
		call(arg){//Int->Int-> ... Int-> Int
			return this.func(arg);
		}
		eval(){return this}
	}
	class List extends Array{
		constructor(list){
			this.list = list;
		}
		call(arg,context,stack){
			;
		}
		eval(){return this}
		list = [];
		static get = new Func((array,index)=>
			!(array instanceof List)?Lambda.null
			:array.list[Lazy.toInt(index)]??Lambda.null
		)
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
				type;
				value;//:Code
				ref;//:Param?
			}
			class BracketPattern extends Pattern{
				constructor(data){super();Object.assign(this,data)}
				parent;
				pattern='()';//'()'|'[]'|'{}'
				list=[];//:Tree<Pattern> ; brackets only
			}
			class Pattern_extra{
				startLabels;//:Map(String,Ref)
				currentLabels;//:Map(String,Ref)
				refs;//:Set(Pattern) & Tree(Pattern)
				refLevel;//:Number
				funcLevel;//:Number ; number of nested lambdas
			};
			class Param{
				constructor(data){Object.assign(this,data)}
				name;//:[String,Number] ; name of the parameter or label
				index;//:number ; if a pattern has muli parameters it shows which one it is.
				owner;//: Pattern & context with a {list:Array} ; is the expression that the label bellongs to
				value;//: Lazy? ; only for assignment patterns
			}
			const comma = {};
		//----
		const match_pattern_arg = ({tree,i,pattern})=>{//'a' or '$1' 
			let oldI=i;
			let getObj = ()=>({i,id:tree[oldI][1],type:"argument",pattern});
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
			if(!pattern){
				hasOwnContext=true;
				options="";
				if(getWord(tree,i)=="?"){options+="?";++i}
				if("\\λ".includes(getWord(tree,i))){pattern="λ";type="function";list=[];++i}
			}
			if(!pattern){//function and assignment | 'with' block | 'use' block
				i=oldI;
				options="";
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
										s=foo(tree[i],i,tree);
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
				hasOwnContext=false;
				i=oldI;
				options="";
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
				tree = tree.filter((v,i)=>typeof v[0]!="string"||!getWord(tree,i)?.match?.(/^(\s*|\/\*[\s\S]*\*\/|\/\/.*)$/));
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
					else if("([{".includes(word)){
						++i;
						let bracket=new BracketPattern({pattern:{"(":"()","[":"[]","{":"{}"}[word],list:[],parent:context,isFirst});
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
		function* forEachTree(context,getTree){//isTree:node->Tree?
			const tree = getTree(context);
			for(let i=0;i<tree.length;i++){
				let [v,a] = [tree[i],context];
				yield [v,i,a];
				yield*forEachTree(v,getTree);
			}
		}
		const forEachPattern = ()=>forEachTree(context,v=>v?.list??[]);
		patterns.forEach = forEachPattern;
		function addRefParam(match,match_parents,param){
			//match:Pattern
			//match_parents:Set(BracketPattern)
			//param:Param
			let higherParamParent = param.owner;//:Pattern
			let argParentIndex;
			//assume: there is not an infinite chain of Pattern.parent's
			if(param.owner.type=="function"||param instanceof Operator)return;//functions can't form ref loops, since it is garantied that `match_parents.includes(param.owner) == true`
			while(
				higherParamParent
				&& -1 == (argParentIndex = match_parents.indexOf(higherParamParent.parent))
			){higherParamParent = higherParamParent?.parent};
			if(argParentIndex==-1)throw Error("compiler error");
			if(!higherParamParent)throw Error("compiler error");
			let higherArgParent = match_parents[argParentIndex-1];
			if(argParentIndex==0){//e.g. '(a a=2)'
				//UNTESTED: unknown behaviour: may not reference errors, where there should be
				return;
			}
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
		function getParam(name,parent,parents=[]){//parents:Pattern[]?
			let param = 
				parent?.currentLabels?.get?.(name)
				??(p=>parents.includes(p?.owner)?undefined:p)(parent?.startLabels?.get?.(name))
			;
			parents?.push?.(parent);
			return param?
				{param,parents}:
				parent.parent?
					getParam(name,parent.parent,parents)
					:undefined
			;
		}
		class Operator extends Param{
			constructor(name,priority,foo){
				super({name:[name,-1],priority,owner:context,value:foo});
				this.value.operatorParamObj = this;//:truthy
			}
			isParsed=false;
			//name:[String,Number]
			//index:Number
			//owner:Pattern
			//value:Lazy
			//priority:Number
		}
		let maxPriority;
		{
			//applies to Patterns with type = "operator"
			context.value = new Lazy;
			let i=0;
			const bool_true = new Lambda(new Lambda(1));
			const bool_false = new Int(0);
			const equality = (a,b)=>{//(Exp,Exp)-> Lambda bool
				a==b?bool_true
				:+a==+b?bool_true//assume: NaN!=NaN
				:a instanceof Array?
					!(b instanceof Array)?bool_false
					:!(a.constructor == b.constructor)?bool_false
					:a.length != b.length?bool_false
					:a.reduce((s,v,i)=>s==bool_false?s:equality(a[i],b[i]),bool_true)
				:bool_false
			}
			context.startLabels= new Map([
				//TODO: allow '!!a' -> '(! (! a))'
				new Operator("!" ,  i,new Func((a)=>Lazy.toInt(a)==0||a==Lambda.null?bool_true:bool_false)),
				new Operator("~" ,  i,new Calc((a)=>~a)),
				new Operator("++",  i,new Calc((a)=>a+1)),
				new Operator("--",  i,new Calc((a)=>a+1)),
				new Operator("&" ,++i,new Calc((a,b)=>a&b)),
				new Operator("|" ,  i,new Calc((a,b)=>a|b)),
				new Operator("^" ,  i,new Calc((a,b)=>a^b)),
				new Operator("**",++i,new Calc((a,b)=>a**b)),
				new Operator("*" ,++i,new Calc((a,b)=>a*b)),
				new Operator("/" ,  i,new Calc((a,b)=>a/b)),
				new Operator("+" ,++i,new Calc((a,b)=>a+b)),
				new Operator("-" ,  i,new Calc((a,b)=>a-b)),
				new Operator("==",++i,new Func((a,b)=>equality(a,b))),
				new Operator("<" ,  i,new Func((a,b)=>a==b?bool_true:bool_false)),
				new Operator(">" ,  i,new Func((a,b)=>a==b?bool_true:bool_false)),
				new Operator(">=",  i,new Func((a,b)=>a==b?bool_true:bool_false)),
				new Operator("<=",  i,new Func((a,b)=>a==b?bool_true:bool_false)),
				new Operator("&&",++i,new Lambda(new Lambda(1,0,1))),
				new Operator("||",  i,new Lambda(new Lambda(1,1,0))),
				new Operator("^^",  i,new Lambda(new Lambda(1,[0,bool_false,1],0))),
			].map(v=>[v.name[0],v]));
			maxPriority= i;
		}
		(function getAssignments(patterns){
			//find definisions
			for(let [match,i,bracketParent] of forEachPattern()){
				match.funcLevel = match.parent?.funcLevel || 0;
				let lastValue = match.isFirst?undefined:bracketParent[i-1];// ','
				if(match.pattern == "="){//assignment
					//assume: bracketParent == match.parent
					{//set up assignment properties
						bracketParent.startLabels ??= new Map();//String|Number => Param
						bracketParent.currentLabels ??= new Map();
						bracketParent.refs ??= new Set();//:Set(BracketPattern) where p.refs.get(x).refs.get(p) == undefined
					}
					let startLabels=bracketParent.startLabels;
					let i=0;
					match.value = new Lazy;//single value, represents the right side of the assignment.
					for(let param of match.params){//param:Param
						if(!startLabels.has(param))startLabels.set(param.name[0],param);
						param.value = match.value;
					}
				}
				else if(match.type == "function"){//assume pre-fix
					if(match.pattern==">")match.startLabels = new Map(match.params.map(v=>[v.name[0],v]));
					match.funcLevel++;
					match.value = new Lambda
				}
				else if(match.pattern == "()="){//with/use
					match.value = bracketParent.value;
				}
				else if(match instanceof BracketPattern){
					if(match.pattern=="()"){
						match.value = [];
					}
					if(match.pattern=="[]"){
						match.value = new List;
					}
					if(match.pattern=="{}"){
						match.value = [];
					}
				}
				if(match.value){
					match.value.id = match.id;
				}
			}
			//find and link references
			for(let [match,i,bracketParent] of forEachPattern()){
				let lastValue = match.isFirst?undefined:bracketParent[i-1];// ','
				if(match.pattern == "="){//assignment
					for(let param of match.params){
						match.parent.currentLabels.set(param.name[0],param);
					}
				}
				else if(match.type == "function"){//function
					match.parent.value.push(match.value);
				}
				else if(match.type == "argument" || match.type == "symbol" || match.type == "number"){
					if(match.pattern == "$"){
						match.value = +match.arg;
						if(typeof match.value == "number"){//lambda parameter
							//validate value
							if(match.value>match.funcLevel){
								throwError(match.id,"reference","the parameter number exceeds the amount of global scopes",a=>Error(a));
							}
						}
					}
					else{
						let {param,parents} = getParam(match.arg,match.parent)??{};
						if(match.type!="number"){
							//note: number literals & other predefined values can be used as either an Int or a parameter reference
							if(!param){
								throwError(match.id,"reference","label: '"+match.arg+"' is undefined",a=>Error(a));
							}
							addRefParam(match,parents,param);
							//assert: param != undefined
							match.ref = param;
							if(param.owner.type == "function"){
								let refLevel = match.funcLevel-param.owner.funcLevel;
								if(param.owner.options[0]=="{"){//is multi assign namespace
									match.value = new Lazy(new Dot(param.name[0]),refLevel);
								}
								else if(param.owner.options[0]=="["){//is multi assign list
									match.value = new Lazy(List.get,refLevel,new Int(param.index));
								}
								else{
									match.value = refLevel;
								}
							}
							else{
								match.value = param.value;
							}
							if(match.value==undefined)throw Error("compiler error");
						}
						else if(!param){//if not overwritten && is number literal
							match.value = new Int(+match.arg);
						}
					}
					match.parent.value.push(match.value);
				}
				else if(match instanceof BracketPattern){
					match.parent.value.push(match.value);
				}
			}
			//handle operator priorities
			for(let [value,i] of 
				function*(){
					yield [context.value,0];
					yield*forEachTree(context.value,v=>v instanceof Array?v:[]);
				}()
			){
				if(!(value instanceof Array && value.length>0))continue;
				let list = value;
				for(let priority=0;priority<maxPriority+1;priority++){
					for(let i=0;i<list.length;i++){
						//'a+b' -> '((+)a b)'
						//'~a' -> '((~)a) '
						let operator = list[i];
						if(!(operator.operatorParamObj instanceof Operator))continue;
						if(!(operator.operatorParamObj.priority == priority))continue;
						let foo = operator.func;
						let useLeftArg = foo.length == 2;
						if(i<list.length-1)//has right argument
						if( (i>0&& !operator.operatorParamObj.isFirst) || !useLeftArg){
							let newOperation = [operator];
							let splice=list.splice(i-useLeftArg,foo.length+1);
							newOperation.push(...(foo.length==2?[splice[0],splice[2]]:[splice[1]]));
							list.splice(i-useLeftArg,0,newOperation);
							i-=useLeftArg;
							//'a + b' -> '(+ a b)'
							//'! a' -> '(! a)'
						}
					}
				}
			}

		}(patterns.list));
		return context;
	}
	let regex =/[λ]|\b\w+\b|"[^"]*"|(?:[!%^&*-+~<>])=|[+\-*&|^=><]{2}|[^\s]|\s+|\/\/.*|\/\*[\s\S]*\*\//g;
	let lines = text.split("\n");
	const words = text.match(regex)??[];
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
	let main=()=>{
		const tree = treeParse(words);
		const context = parseContexts(tree);
		const expression = context.value;
		return expression;//parse(tree);
	}
	if(TEST){
		return main()??new Lazy(Lambda.null);
	}
	else try{//main
		return main();
	}catch(error){
		console.log(error);
		return new Lazy(Lambda.null);
	}
}
//loga(compile(`a>b>a,2`).eval())//f>(r>r x>f(r x),a>a a)`));
//loga(Y.call(new Calc((f,n)=>n==0?1:n*f.call(n-1))).call(new Int(4)));