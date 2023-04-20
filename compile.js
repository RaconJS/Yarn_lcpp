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
		class NameSpace extends Exp{
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
	function treeParse(words,index){
		let list = [];
		let value;
		let done;
		while(!done){
			{
				value = iter.next();
				done = value.done;
			}
			if(value[0].match(/[(\[{]/)){

			}

		}
		return list;
	}
	function parse(context=[]){
		let list = [];
		let startList = list;
		let startContext = context;
		let word = iter.next(),value1;
		for(let i = 0;i<text.length&&!word.done;i++){
			let value = word.value;
			word= value[0];
			if(word.match(/^\/\/|^\/\*|\s+/)){}//ignore comments & white space
			else if(word == "("){
				list.push(parse(context));
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
			else if(word=="="){
				throw Error("assignment '=' is not supported")
				//startList.push(new RecurSetter(,list=new Lazy()));
			}
			else if((value1=iter.next().value)[0]==">"){
				context = [word,...context];

				list.push(list = Object.assign(new Lambda(),{id:value1}));
			}
			word = iter.next();
		}
		if(list.length == 0&&list!=startList)startList.pop();
		if(startList.length==1)startList = startList[0];
		return startList;
	}
	let regex =/[λ]|\b\w+\b|"[^"]*"|[^\s]|\s+|\/\/.*|\/\*[\s\S]*\*\//g;
	let list = text.matchAll(regex);
	let iter = list;//list[Symbol.iterator]();
	return new Lazy(...parse());
}
loga(compile(`f>(r>r x>f(r x),a>a a)`));
//loga(Y.call(new Calc((f,n)=>n==0?1:n*f.call(n-1))).call(new Int(4)));