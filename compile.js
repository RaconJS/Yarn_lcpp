//classes
	//Exp: Lambda'λ' | Lazy'()' | Recur'::'
	//OutExp: Lazy
	function findHighestContext(list){//list:Exp[]
		return list.reduce((s,v)=>Math.max(s,typeof v=="number"?v:s.findHighestContext()),-1);
	}
	class Lazy extends Array{//lazy evaluation
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
			return this.map(v=>//[]->{call:(arg:Lazy,Stack)->{call:(arg,Context,Stack)->Lazy}}[]
				typeof v == "number"?context.getValue(v):
				typeof v == "string"?v://simple raw string cannot be called
				//typeof v == "string"?:
				v instanceof Int?v:
				v instanceof Lambda?Object.assign(new Lazy(v),{context}):
				v instanceof Lazy?v:
				v instanceof RecurSetter?Object.assign(new Lazy(v.exp),{context,recur:+this.toInt(v.recur)??0}):
				v instanceof NameSpace?v:
				v instanceof Array?Object.assign(new Lazy(...v),{context}):
				v instanceof Object?(v=>{
					let labels={};
					for(let i in v){
						labels[i]=new Lazy(v[i])
					}
					return new NameSpace(labels);
				})(v):
				typeof v.call == "function"?v:
				v//ERROR
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
		class Exp{}//expression
		class Lambda extends Array{
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
			eval(){return this}
		}
		class RecurSetter{
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
			eval(){return this}
		}
		class NameSpace{
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
			eval(){return this}
		}
		class Dot{
			call(){

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
	class Name {}
	//ints
	//f>x>f (x x)

	//f>(a>a a)x>f a a=x x
	//const Y = new Lambda(new Lambda(0,0),new Lambda(new Lambda(2,0),[0,0]));
	const Y = new Lambda(new Lambda(1,[0,0]),new Lambda(1,[0,0]));
	const vec2 = new Lambda(new Lambda({x:1,y:0}));//x>y>{x y}
	const recur = new Lambda();
//----
function loga(...logs){console.log(...logs)}
function compile (text){
	function parse(list){}
}
loga(Y.call(new Calc((f,n)=>n==0?1:n*f.call(n-1))).call(new Int(1)))