//TEST
const TEST = false;
//UNTESTED
//TODO
//BODGED
//classes
	//Exp: Lambda'λ' | Lazy'()' | Recur'::'
	//OutExp: Lazy
	function findHighestContext(list){//list:Exp[] ; for memory management. finds the deepest parent referenced by an expression
		return list.reduce((s,v)=>Math.max(s,typeof v=="number"?v:s.findHighestContext()),-1);
	}
	class Exp{
		//id:WordData
		call(arg,context,stack){return stack.doOnStack(this,stack=>this.eval(stack).call(arg,context,stack))}
		eval(stack){return this}//lazy evaluatuation
		evalFully(stack){return (this instanceof Lazy?this:new Lazy(this)).evalFully(stack)}//non-lazy evaluation
		toJS(){return Object.assign((...args)=>args.reduce((s,v)=>s.call(v),this),{})}
		static fromJS(value,fileName){//:Exp
			const addId = v=>Object.assign(v,{id:new WordData({fileName})});
			let ans;
			switch(typeof value){
				case"function":ans = new Func(value);break;
				case"number":ans = value===value|0?new Int(value):new Float(value);break;
				case"string":ans = new StringExp(str);break;
				case"undefined":ans = Lambda.null;break;
				case"object":
					ans =  
						value instanceof Exp?value:
						value instanceof Exp_Array?value:
						value instanceof Exp_Number?value:
						value instanceof Exp_String?value:
						value instanceof Array?new value:
						new NameSpace(value)
					;
					if(ans.id==undefined)ans.id = addId(ans);
				break;
			}
			return ans == Lambda.null?ans:addId(ans);
		}
		static symbol = Symbol("is expression");
		//labels:Map(string=>Exp);
	}
	class Exp_Array extends Array{}
	class Exp_Number extends Number{}
	class Exp_String extends String{}
	Exp.prototype[Exp.symbol] = true;
	for(let i of ["call", "eval", "evalFully", "toJS","symbol",Exp.symbol]){
		Exp_Array.prototype[i]??=Exp.prototype[i];
		Exp_Number.prototype[i]??=Exp.prototype[i];
		Exp_String.prototype[i]??=Exp.prototype[i];
	}
	var files={
		list:new Map([]),//Map(fileName => FileData)
		FileData:class FileData extends Exp{//data for errors
			constructor(data){super();Object.assign(this,data);}
			//note these properties are not used in the Expression classes.
			text;//:string
			words;//:string[]
			tree;//:tree([string,id,FileData])
			lines;//:string[]
			context;//:BracketPattern
			expression;//:Lazy
			get value(){return this.expression}//:Exp
			call(arg,context = new Context,stack = new Stack){return this.value.call(arg,context,stack)??Lambda.null}
			eval(stack = new Stack){return this.value.eval(stack)??Lambda.null}
			evalFully(stack = new Stack){return this.value.evalFully(stack)}
		},
		addInbuilt(exp,name="SOURCE"){
			let word = "SOURCE:[ "+name+" ]";
			exp.id = new WordData({
				line:1,column:1,fileName:["SOURCE"],
				word,
				maxRecur:Infinity,
				file:new this.FileData({expression:exp,lines:[word]}),
			});
			return exp;
		},
		reset(){},
	};
	function ID(data){//data:WordData
		return data;
	}
	class WordData{
		constructor(data){
			Object.assign(this,data);
			this.file=data.file;
		}
		//getter and setter used to make console logs look neater
		get file(){return this.#file}
		set file(v){this.#file=v}
		#file;
		maxRecur = Infinity;
		//line:1,column:1,lines,file,word:"",maxRecur:Infinity
		throwError(type,errorMessage,error,stack){//error = str=>Error(str)
			//note: lines and colums are counted from 1
			if(!TEST)error=a=>a;
			throw error(
				"lc++ ERROR:\n"
				//"l:"+data.line+" c:"+data.column+"\n"
				// " ".repeat(lineLen)+" |\n"
				+this.displayWordInLine(type+" error")+"\n"
				+"error"+": "+errorMessage+"\n"
				+(!stack?"":
					"stack:\n"
					+stack.map(id=>id.displayWordInLine("at")).join("\n")
				)
			);
		}
		displayWordInLine(msg){
			let line = this.file.lines[this.line-1];
			let whiteSpace = line.match(/^[\t ]*/)?.[0]??"";
			let whiteLen = whiteSpace.length;
			line = line.substr(whiteLen)//[whiteSpace,line]
			let lineLen = (""+this.line).length;
			return ""
				+this.line+" |" +line+"\n"
				+" ".repeat(lineLen)+" |" +" ".repeat(this.column-1-whiteLen)+"^".repeat(this.word.length)+" "+msg
			;
		}
	}
	class FilelessWordData extends WordData{
		//word
		displayWordInLine(){
			return "SOURCE: "+this.word;
		}
	}
	class Lazy extends Exp_Array{//:Exp ; lazy evaluation
		//Lazy : Exp[]
		context;//:Context
		findHighestContext(){
			return this.highestContext?this.highestContext:
				findHighestContext(this);
		}
		constructor(...exps){
			//if(exps.includes(undefined))throw Error("compiler error");
			super(exps.length);
			Object.assign(this,exps);
		}
		//note: all arguments are optional in curtain cases.
		call(arg,context,stack){//(arg:Lazy,Stack)->Lazy
			if(this.length == 1 && this[0] instanceof Lambda)return this[0].call(arg,this.context,stack);
			else return this.eval(stack).call(arg,this.context,stack);
		}//(a>a)(a>a a)
		isReducable(exp){//returns to if exp.eval() != exp
			return exp instanceof Lazy || exp.constructor==Array;
		}
		eval(stack=new Stack()){
			let ans = this;
			{
				//[x],Lazy(x),1::x -> x; where x:Lazy|Array|RecurSetter
				while(ans.length==1 && this.isReducable(ans[0]))ans=ans[0];//assume: ans is Tree
				//ans:Lazy|Array
				if(ans.length == 0)
					if(1)throw Error("compiler error: all null values should be delt with at compile time");
					else return Lambda.null;
			}
			const context = this.context;
			//note this.map first calls 'new Lazy(this.length)' which is overwriten if there is at least 1 item in the expression.
			ans = ans.map(v=>//[]->{call:(arg:Lazy,Stack)->Combinator|Lazy&{call:(Exp,Context,Stack,Number)->Lazy}}[]
				typeof v == "number"?context.getValue(v):
				typeof v == "string"?v://simple raw string cannot be called
				//typeof v == "string"?:
				v instanceof Lambda?Object.assign(new Lazy(v),{context,id:v.id}):
				v instanceof RecurSetter?v.context?v:Object.assign(new RecurSetter(...v),{...v,context,id:v.id}):
				v instanceof Reference?Object.assign(new Lazy(v.value),{id:v.id,context:context.getContext(v.levelDif)}):
				v instanceof Lazy?v:
				v instanceof Float?v:
				v instanceof Int?v://assume (Int extends Float) or (Float extends Int)
				v instanceof List?v:
				v instanceof StringExp?v:
				v instanceof NameSpace?v:
				v instanceof Exp||
				v instanceof Exp_Array||
				v instanceof Exp_String||
				v instanceof Exp_Number?v:
				v instanceof Array?Object.assign(new Lazy(...v),{context,id:v.id??this.id}):
				/*v instanceof Object?(v=>{
					let labels=new Map();
					for(let i in v){
						labels.set(i,Object.assign(new Lazy(v[i]),{}));
					}
					return new NameSpace(labels);
				})(v):*/
				v//uncallable object
			).reduce((s,v)=>
				stack.doOnStack(v,stack=>s.call(v,context,stack))
			);
			//optimise for next time.
			if(this.length>1)this.splice(0,this.length,ans);
			return ans;
		}
		evalFully(stack=new Stack()){
			let ans = this;
			while((!(ans.length==1 && ans[0] instanceof Lambda)&& ans instanceof Lazy) || ans instanceof RecurSetter)
				ans = ans.eval(stack);
			return ans;
		}
		toInt(foo,stack){//foo:{call(inc)->{call(0)->Number}}
			return this.constructor.toInt(foo,stack);
		}
		static toInt(foo,stack=new Stack){//foo:{call(inc)->{call(0)->Number}}
			foo = foo.evalFully(stack);
			if(foo instanceof Int)return foo;
			const inc = Int.increment;
			const zero = new Int(0);
			let ans = foo.call(inc,undefined,stack).call(zero,undefined,stack);
			return ans?.eval?.(stack)??ans;
		}
	}
	class Lambda extends Exp_Array{//:Exp
		constructor(...exps){
			super(exps.length);
			Object.assign(this,exps);
		}
		id;//:WordData
		static null = new class Null extends Exp{
			call(arg){return arg}
		};
		findHighestContext(){
			return this.highestContext?this.highestContext:
				findHighestContext(this);
		}
		call(arg=undefined,context=new Context(),stack){
			context = new Context(context,arg);
			return Object.assign(new Lazy(...this),{context,id:this.id}).eval(stack);
		}
	}
	class RecurSetter extends Exp_Array{//'value::recur'
		constructor(...list){
			super(list.length);
			Object.assign(this,list);
		}
		recur;//:Lazy
		context;//:Context?
		id;//:WordData
		getRecursLeft(stack){//()-> finite Number | Infinity
			if(this.recur.length==1 && this.recur[0] == RecurSetter.forever)return Infinity;
			let ans = stack.doOnStack(this.recur,stack=>Lazy.toInt(Object.assign(new Lazy(...this.recur),{id:this.recur.id,context:this.context}),stack));
			if(+ans == Infinity||+ans<0||isNaN(+ans))ans = 0;//make finite
			return ans;
		}
		eval(stack=new Stack){
			return Object.assign(new Lazy(...this),{
					context:new Context(this.context,undefined,this.getRecursLeft(stack)),
					id:this.id,
				}
			).eval(stack);
		}
		toJS(){return this[0].toJS?.()}
		static forever = new Lambda(new Lambda(0));
	}
	class Reference extends Exp{//wrapper for Lazy
		constructor(value,levelDif,id){
			super();
			this.value=value;//:Exp
			this.levelDif=levelDif;//:Number
			this.id = id;//:WordData
		}
		call(arg,context=new Context,stack){
			//context??= new Context();
			stack.unshift(this.id);
			let value = Object.assign(new Lazy,this.value);
			value.context=context.getContext(this.levelDif);
			let ans = value.call(arg,context,stack);
			stack.shift();
			return ans;
		}
		eval(stack){return this.value.eval(stack);}
		toJS(){return this.value.toJS?.()}
	};
	class Context{
		static null;//:Context
		constructor(parent,argument,maxRecur){
			Object.assign(this,{
				parent,//:Context?
				argument,//:Lazy|{String->Lazy}|Lazy[]
				maxRecur,//:maxRecur
			});
			this.chainLen=(parent?.level??-1)+1;//:Number
		}
		get maxRecur(){
			return this.maxRecurValue??this.parent?.maxRecur;
		}
		set maxRecur(value){
			this.maxRecurValue = value;
		}
		getContext(num){
			let context = this;
			for(let i=0;i<num;i++){
				context = context.parent;
			}
			return context;
		}
		getValue(num){
			return this.getContext(num).argument;
		}
	}
	Context.null = new Context();
	class Stack extends Array{
		currentMaxRecur = 1;//:Number ; mutable by RecurSetter.prototype.eval
		constructor(...exps){
			super(exps.length);
			Object.assign(this,exps);
		}
		doOnStack(arg,foo){
			let stackableObject = arg;//expression that will be added onto the stack.
			const data = stackableObject.id;
			let oldMaxRecur = data?.maxRecur;
			let recurs = {value:0};//
			if(!this.#add(stackableObject,arg,recurs)){//recurs:mut
				recurs = recurs.value;
				//note: stack.add already removes the lambda from the stack, so it does not need to be done here.
				//recursion detected
				if(1){
					data.throwError("recursion", "unbounded recursion detected. Recursion level: "+recurs+"",a=>Error(a),this);
				}else return Lambda.null;
			}else {}
			let ans = foo(this);
			this.#remove(stackableObject);
			if(data)data.maxRecur = oldMaxRecur;
			return ans;
		}
		#add(exp,recurSetter=undefined,recurs_out){
			let id = exp.id;
			if(id!=undefined){
				this.unshift(id);
			}
			else return true;
			//recurSetter:RecurSetter
			const stack = this;
			let recursLeft= exp.context?.maxRecur ?? 1;
			let data = id;
			let [isValid,recurs] = this.stackCheck(data.maxRecur);
			let newRecursLeft = recursLeft + recurs;
			let isLen1 = exp instanceof Exp_Array?exp.length == 1:false;
			//assume length 1 expressions can't recur infinitely since they don't call their parts
			if(recurs <= 1 || isLen1 || newRecursLeft<data.maxRecur) data.maxRecur = newRecursLeft;
			if(isLen1)isValid = true;
			if(!isValid){
				this.shift();
			}
			recurs_out.value = recurs;
			return isValid;
		}
		#remove(lambda){
			if(lambda.id==undefined)return;
			this.shift();
		}
		stackCheck(maxRecur){//only checks last item
			//:Number->[bool,Number]
			if(maxRecur==Infinity||maxRecur>this.length)return [true,0];
			let recurs=1;
			let id = this.shift();
			let lastId=this.indexOf(id);
			if(this.length-lastId<maxRecur){
				this.unshift(id);
				return[true,2];//BODGED
			}
			let stackStr = this.join(",")+",";
			let matchStackStr = this.map(v=>v).splice(0,lastId).join(",")+",";
			this.unshift(id);
			recurs = [...stackStr.matchAll(matchStackStr)].length;
			if(0){
				if(lastId==-1)return [true,recurs];
				for(let i=lastId+1;i<this.length;){
					let isMatch=true;
					if(this[i]!=id){i++;continue}
					else i++;
					if(i+lastId>this.length){return [true,recurs]}
					if(lastId>0)
					for(let i1=0;i1<lastId;[i1++,i++]){
						if(this[i]!=this[i1+1]){isMatch=false;break;}
					}
					if(isMatch){
						recurs++;
						if(recurs>=maxRecur)return [false,recurs];
					}
				}
				return [true,recurs];
			}
			return [recurs<=maxRecur,recurs];
		}
	}
	//js functions:
		class ArrowFunc extends Exp{//arraw function
			constructor(func,id){
				super();
				this.func=func;
			}
			//isOperater:bool&Operator?
			call(arg,context,stack){//Int->Int-> ... Int-> Int
				return this.func(arg,context,stack);
			}
			toJS(){return this.func}
		}
		class MultiArgLambdaFunc extends Exp{//arraw function
			constructor(func,len,args=[]){
				super()
				this.func = func;//:(...Number[])->Number
				this.len = len;
				this.args = args;//:Lazy[]
			}
			//isOperater:bool&Operator?
			call(arg,context,stack){//Int->Int-> ... Int-> Int
				if(this.args.length>=this.len-1){
					return this.func([...this.args,arg],context,stack);
				}
				else return new this.constructor(this.func,this.len,[...this.args,arg]);
			}
			toJS(){return (...args)=>this.func([...args])}
		}
		class Func extends MultiArgLambdaFunc{
			constructor(func,args=[],stack=undefined){
				super((args,context,stack)=>func(...args),func.length);
			}
			toJS(){return this.func}
		}
	class NameSpace extends Exp{//'{a b c}' and '{a<=1,b<=2,c<=3}'
		constructor(labels,exp){//labels:Map(string,Exp)
			this.labels = labels;
			this.exp = exp;
		}
		labels;//labels:Map(string,Exp)
		exp;//: Exp
		call(arg,context,stack){
			if(this.exp)return this.exp.call(arg,context,stack);//{a>a a} x -> (a>a a) x
			if(arg instanceof NameSpace)return new NameSpace(new Map(...this.labels,...arg.labels),arg.exp);
			else return new NameSpace(this.labels,arg);
		}
		toJS(){
			let newObj = {};
			for(let [v,i] of this.labels){
				newObj[i]=v.toJS?.()??v;
			}
			return newObj;
		}
		static get = new class NameSpace_Get extends MultiArgLambdaFunc{}(function get([obj,property],context,stack){
			obj = obj.evalFully(stack);
			property = property.evalFully(stack);
			getIndex:if(property instanceof Float){
				if(obj instanceof List)return obj[property|0]??List.null;
				if(obj instanceof NameSpace)break getIndex;
			}
			else if(!(property instanceof StringExp))return Lambda.null;
			let propertyStr = ""+property;
			if(obj instanceof NameSpace){
				let ans = obj.labels.get(property);
				if(obj.exp)return get([obj.exp,priority],context,stack);
				if(!ans)return Lambda.null;
			}
			else if(obj instanceof List){
				if(propertyStr=="length"){
					return new Int(obj.length);
				}
				if(List.methods.has(propertyStr))return List.methods.get(propertyStr).call(obj,context,stack);
			}
			return Lambda.null;
			obj instanceof List ||
			obj instanceof Float ||
			obj instanceof StringExp
			Lambda.null
		},2);
		static dot = this.get;
	}
	class Float extends Exp_Number{
		constructor(value){
			super(value);
		}
		toJS(){return+this}
		static Part1 = class IntPart extends Exp{
			constructor(value,arg_f){
				super();
				this.value = value;//:Number|Int
				this.arg_f = arg_f;//:Lazy
			}
			call(arg_x,context,stack){//(f>x>n f x,arg_f,arg_x)
				if(this.arg_f == Float.increment && arg_x instanceof Float)//optimises 'n ++ 0'
					return new (arg_x instanceof Int?Int:Float)(1+arg_x);
				let ans = arg_x;
				for(let i = 0;i<this.value;i++){
					ans = this.arg_f.call(ans,context,stack);
				}
				return ans;
			}
			eval(){return this}
		};
		static increment = new class Increment extends Exp{
			//n> f>x>f(n f x)
			call(arg,context,stack){return new Int(arg+1)??this.lazyExpVersion.call(arg)};
			eval(stack){return this};
			lazyExpVersion=new Lambda(new Lambda(new Lambda(1,[2,1,0])));
		};
		call(arg_f){//f>x>
			return new this.constructor.Part1(this,arg_f);
		}
		eval(){return this}
	}
	class Int extends Float{
		constructor(value){
			super(value|0);
		}
	}
	class Calc extends ArrowFunc{//calculation
		constructor(func,fallBackExp,args=[]){
			super(func)//func:(...Number[])->Number
			this.fallBackExp = fallBackExp;//:Exp
			this.args = args;//:Lazy[]
		}
		//isOperater:bool&Operator?
		call(arg,context,stack){//Int->Int-> ... Int-> Int
			let args = [...this.args,arg];
			if(this.args.length+1>=this.func.length){
				const ans = this.func(...args.map(v=>+Lazy.toInt(v,stack)));
				const nullValue = Lambda.null;
				return typeof ans == "number"?
					isNaN(ans)?
						this.fallBackExp?
							args.reduce((s,v)=>s.call(v),this.fallBackExp)
							:nullValue//args.reduce((s,v)=>s.call(v,context,stack),this.fallBackExp)
						:new Int(ans)
					:ans??nullValue
				;//can return custom Exp objects.
			}
			return new this.constructor(this.func,this.fallBackExp,[...this.args,arg],stack)
		}
		eval(stack){return this}
	}
	class List extends Exp_Array{
		//tuple
		constructor(...list){
			super(list.length);
			Object.assign(this,list);
		}
		labels
		static #ListWithEnd = class extends Exp{
			constructor(list,end,id){
				super();
				this.#list=list;
				this.#end = end;
				this.id = id;
				if(this.#list.length<1)throw Error("compiler error");
			}
			#list;//:List|Array
			#end;//:Exp
			id;//:ID
			call(arg,context,stack){
				let bool = arg;
				let head = this.#list[0];
				let tail;
				if(this.#list.length == 1)tail = this.end;
				else {
					//note don't need to add ID to the new List since it cannot be accessed outside this class
					tail = new this.constructor([...this.#list],this.#end);
					tail.#list.shift();
				}
				return bool.call(head,context,stack).call(tail,context,stack);
			}
		}
		call(arg,context,stack){
			let id = this.id;
			return Object.assign(new this.constructor.#ListWithEnd(this,arg),{id});
			this.constructor.concat.call(this,context,stack).call(arg,context,stack);
		}
		eval(){return this}
		toJS(){return [...this.map(v=>v.toJS?.()??v)]}
		static null = new class EndOfList extends Exp{
			toJS(){return null};
			call(){return this}
		}//a>(a>b>a a,a>b>a a)
		static toList(exp,stack){
			exp = exp.evalFully(stack);
			if(exp instanceof List)return exp;
			return Object.assign(new List(),exp.id);
		}
		static get = new class List_Get extends MultiArgLambdaFunc{}(([array,index],context,stack)=>{
			let ans;
			array=array.evalFully(stack);
			if(array instanceof List)ans = array[index.evalFully(stack)|0];
			return ans??Lambda.null;
		},2);//is defined later
		static concat = new class List_Concat extends MultiArgLambdaFunc{}(([listA,listB],context,stack)=>{
			listA=listA.evalFully(stack);
			listB=listB.evalFully(stack);
			return Object.assign(
				listB instanceof List?new List(...listA,...listB)
				:listA instanceof List?new List(...this,listB)
				:new List(listA,listB)//'[1 2] 3' => '[1 2] [3]' => '[1 2 3]'
			,{id:listA.id})
		},2);
		static #spairIDs = {
			int:new FilelessWordData({word:"List_int"}),
			list:new FilelessWordData({word:"List_list"})
		};
		static map = new class List_Map extends MultiArgLambdaFunc{}(
			([list,foo],context,stack)=>stack.doOnStack(List.map,stack=>
				(list=this.toList(list,stack)) instanceof List?
					 Object.assign(
						list.map(
							(v,i,a)=>foo.call(
								Object.assign(new List(v,Object.assign(new Int(i),this.#spairIDs.int),a),this.#spairIDs.list),
								context,
								stack
							),
						),
						{id:list.id}
					)
				:Lambda.null
			)
		,2);
		//similar to Int(), same as 'l>f>x>l.length ([s i a]>[f[s l.(i) i a] ++i a])[x 0 l]'
		static forEach = new class List_Map extends MultiArgLambdaFunc{}(
			([list,foo,startingState],context,stack)=>stack.doOnStack(List.map,stack=>
				(list=this.toList(list,stack)) instanceof List?list.reduce(
					(s,v,i,a)=>foo.call(
						Object.assign(new List(s,v,Object.assign(new Int(i),this.#spairIDs.int),a),this.#spairIDs.list),
					context,stack),
				startingState)
				:Lambda.null
			)
		,3);
		//same as 'l>f>l.length ([s i a]>[f[s l.(i) i a] ++i a])[l.(0) 0 l]'
		static reduce = new class List_Map extends MultiArgLambdaFunc{}(
			([list,foo],context,stack)=>stack.doOnStack(List.map,stack=>
				(list=this.toList(list,stack)) instanceof List?list.reduce(
					(s,v,i,a)=>foo.call(
						Object.assign(new List(s,v,Object.assign(new Int(i),this.#spairIDs.int),a),this.#spairIDs.list),
					context,stack),
				):Lambda.null
			)
		,2);
		static methods = new Map([
			["get",this.get],
			["concat",this.concat],
			["map",this.map],
			["forEach",this.forEach],
			["reduce",this.reduce],
		]);
	}
	class StringExp extends Exp_String{
		constructor(string){
			super(string);
		}
		call(arg,context,stack){
			if(arg instanceof StringExp)return new StringExp(this+arg);
			else return List.concat.call(this,context,stack).call(arg,context,stack);
		}
		toJS(){return""+this}
	}
	//const Y = new Lambda(new Lambda(0,0),new Lambda(new Lambda(2,0),[0,0]));
	let Y = new Lambda(new Lambda(1,[0,0]),new Lambda(1,[0,0]));
	let vec2 = new Lambda(new Lambda({x:1,y:0}));//x>y>{x y}
	let recur = new Lambda();
//----
function loga(...logs){console.log(...logs);return logs[0]};
let files_startId;
{
	[
		[Int.prototype,"Int"],
		[Calc.prototype,"Calc"],
		[ArrowFunc.prototype,"Function"],
		[Int.increment,"increment"],
		...[...List.methods].map(v=>[v[1],[v[0]]]),
		[RecurSetter.forever],
		[RecurSetter.forever[0]],
	].forEach(v=>files.addInbuilt(v));
}
function compile (text,fileName){
	if(typeof text != "string")throw throwError_noLine("basic API", "'compile' requires a string input as the source code.",a=>Error(a));
	//types
		//syntax, reference
	if(fileName=== undefined)fileName=(()=>{
		for(let [fileName,value] of files.list.entries())
			if(value.text == text)return fileName;
		return undefined;
	})(); 
	if(fileName!=undefined&&files.list.has(fileName)){
		return files.list.get(fileName).context;
	}
	function throwError_noLine(type,errorMessage,error){
		return error(
			"lc++ ERROR:\n"
			+type+" error"+"\n"
			+errorMessage
		);
	}
	function treeParse(wordsData){
		let list = [];
		let stack = [];
		for(let i=0;i<wordsData.length;i++){
			let data = wordsData[i];//:WordData
			let word = data.word;
			let value = [word,new ID(data)];//:[String,WordData&ID]
			if(word.match(/^\//))list.push(value);
			else if(word.match(/[(\[{]/)){
				stack.push(list);
				list.push(value,list = []);
			}
			else if(word.match(/[)\]}]/)){
				list = stack.pop();
				if(!list)data.throwError("syntax", "unballanced brackets: Too many closing brackets", a=>Error(a));
				//assert: list[list.length-2] exists
				let openBracket = list[list.length-2][0];
				if(({"(":")", "[":"]", "{":"}"})[openBracket]!=word)data.throwError("syntax", "unmatching brackets:'"+openBracket+"..."+word+"'", a=>Error(a));
				list.push(value);
			}
			else list.push(value);
		}
		if(stack.length>0)wordsData[wordsData.length-1].throwError("syntax", "unballanced brackets: Too many opening brackets", a=>Error(a));
		return list;
	}
	function parseContexts(tree){
		//classes & consts
			const numberRegex = /^(?:[0-9]+(\.[0-9]*)?|0x[0-9a-fA-F]+(\.[0-9a-fA-F]*)?|0b[01]+(\.[01]*)?)$/;
			const getWord = (tree,i)=>tree[i]?.[0]??"";
			const getID = (tree,i)=>tree[i]?.[1];
			function parseString(string){
				string = string.substr(1,string.length-2);
				string = string.replace(/\\(\s\S)/,(m,char)=>({"t":"\t","n":"\n"})[char]??char);
				let indent = string.split("\n").reduce((s,v)=>Math.min(s,v.match(/^\s*/)?.length??0),Infinity);
				return string;
			}
			class Pattern{
				constructor(data){
					Object.assign(this,data);
				}
				id;//:WordData
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
				id;//:WordData
			}
			class Pattern_extra{
				startLabels;//:Map(String,Ref)
				currentLabels;//:Map(String,Ref)
				refs;//:Set(Pattern) & Tree(Pattern)
				refLevel;//:Number
				funcLevel;//:Number ; number of nested lambdas
			}
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
				if("\"'`".includes((word=getWord(tree,i))[0])){
					pattern = word[0];
					++i;
					return new Simple({...getObj(),type:"string",arg:word})
				}
				if((word=getWord(tree,i))=="$"){
					pattern = "$";
					++i;
					if(getWord(tree,i).match(numberRegex)){
						let params = [tree[i]];
						++i;
						return new Pattern({...getObj(),params})
					}
					else {i=oldI;pattern = ""}
					return new Pattern({...getObj()})
				}
				else if(word.match(numberRegex)){
					pattern = "";
					i++;
					let match = new Simple({...getObj(),arg:word});
					match.type="number";
					return match;
				}
				else if(word.match(/^\w+$/)){
					pattern = "";
					i++;
					let match = new Simple({...getObj(),arg:word});
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
			let params=[];//:Tree|[String,Number][]
			let hasOwnContext=false;
			let type="operator";
			let oldI=i;
			if(!pattern){
				let word = getWord(tree,i);
				if(word=="<"){ //'< a' or '< a $ n'
					++i;
					if(getWord(tree,i).match(/\w+/)){
						pattern = "<";
						type = "return";
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
				if("\\λ".includes(getWord(tree,i))){pattern="λ";id=getID(tree,i);type="function";list=[];++i}
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
						tree[i+1].filter(filterTree).forEach((v,i,tree,word)=>typeof(word=getWord(tree,i))=="string" && !"()[]{}".includes(word)?params.push(tree[i]):0);
						i+=3;
					}
					else params = [tree[i++]];
				}
				if(getWord(tree,i)=="?"){options+="?";++i}
				if(getWord(tree,i)==">"){options+=pattern=">";id=getID(tree,i);++i;type="function";}
				else {
					if(getWord(tree,i)=="<"){options+="<";++i}
					if(getWord(tree,i)=="="){options+=pattern="=";id=getID(tree,i);++i;type="assignment";}
					if(getWord(tree,i)==">"){options+=">";++i}
				}
				if(options.includes("(")&&pattern){//()> or ()=
					pattern = "()=";//use and with blocks are counted as with blocks
					type = "with";//{">"}[options.match(/(?<=\)).*$/)];
				}
			}
			if(!pattern){//set recur
				hasOwnContext=false;
				i=oldI;
				options="";
				if(getWord(tree,i)=="::" && i>0){
					pattern = "::";
					type = "recursion";
					hasOwnContext = true;
					++i;
				}
			}
			if(!pattern){//dot operator
				hasOwnContext=false;
				i=oldI;
				options="";
				params = [];
				if(getWord(tree,i)=="."){//'.1' '.b' or '. exp'
					pattern = ".";
					type = "property";
					++i;
					if(word = getWord(tree,i).match(numberRegex)){
						params = [tree[i]];
						options = "index";
						++i;
					}
					else if(word = getWord(tree,i).match(/^\w+$/)){
						params = [tree[i]];
						options = "property";
						++i;
					}
					hasOwnContext = true;
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
		function* getPatterns(tree,bracketContext){
			let context = bracketContext;
			let word;
			let isFirst=true;//marks the start of a list e.g. ',' or '('. Is used to sepparate certain patterns.
			tree = tree.filter(filterTree);
			for(let i=0;i<tree.length;){
				word = getWord(tree,i);
				let match = match_pattern(tree,i);
				if(context.pattern == "." && context.params?.[0])isFirst=false;//'.b'
				if(!isFirst)while(context.pattern=="::"||context.pattern == "."){//takes in a single, short expression
					context=context.parent;
				}
				if(match.pattern||(match instanceof Simple)){
					({i}=match);
					if(match.pattern == "."){//'a.b'
						//prevent '(. b)' or ', . b' from evaling to '()'
						if(isFirst){//if no 'a' or 'b' argument '(.)' is parsed as a label
							//'a . . b' -> '(. a (.))b'
							const simple = new Simple({arg:word,id:match.id,type:"symbol",isFirst,parent:context});
							simple.value = NameSpace.get;
							if(match.params)i--;//'.b' -> '(.)b'
							match = simple;
							{
								yield match;
								context.list.push(match);
								//++i;
								isFirst = false;
								continue;
							}
						}
						//parsing full 'a.b' pattern
						//gets the 'a' part
						let match_arg = context.list.pop();
						if(!match_arg)throw Error("compiler error: May have to change 'if(isFirst)'.");
						match_arg.parent = match;
						//match_arg.isFirst = true;
						match.list.push(match_arg);
					}
					if(match.pattern == "::"){//get left arg match for 'r :: a'
						//prevent '(:: ... )' or ', :: ...'
						if(isFirst){//if no 'r' argument '(::)' is parsed as a label
							const simple = new Simple ({arg:word,id:match.id,type:"symbol",isFirst,parent:context});
							match = simple;
							{
								yield match;
								context.list.push(match);
								++i;
								isFirst = false;
								continue;
							}
						}
						let match_arg = context.list.pop();
						if(!match_arg)throw Error("compiler error: May have to change 'if(isFirst)'.");
						match_arg.parent = match;
						match_arg.isFirst = true;
						match.list.push(match_arg);
					}
					match.parent = context;
					context.list.push(match);
					match.isFirst=isFirst;
					if(match.list){
						context=match;
						isFirst=true;
					}
					else isFirst=false;
					yield match;
					continue;
				}
				else if("([{".includes(word)){
					let id = tree[i][1];
					++i;
					let bracket=new BracketPattern({pattern:{"(":"()", "[":"[]", "{":"{}"}[word],list:[],parent:context,isFirst,id});
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
					let id = tree[i][1];
					context = new BracketPattern({pattern:",",parent:bracketContext,list:[],isFirst,id});
					yield context;
					bracketContext.list.push(context);
					isFirst=true;
					i++;
					continue;
				}
				else {
					let match = new Simple({id:tree[i][1],arg:word,type:"symbol",parent:context,isFirst});
					yield match;
					context.list.push(match);
				};
				i++
				isFirst=false
			}
		}
		//extra functions for getAssignments
			let context = new BracketPattern;
			function filterTree(v,i,tree){
				return typeof v[0]!="string"||!getWord(tree,i)?.match?.(/^(\s*|\/\*[\s\S]*\*\/|\/\/.*)$/);
			}
			[...getPatterns(tree,context)];//mutates context
			function* forEachTree(context,getTree){//isTree:node->Tree?
				const tree = getTree(context);
				for(let i=0;i<tree.length;i++){
					let [v,a] = [tree[i],context];
					yield [v,i,a];
					yield*forEachTree(v,getTree);
				}
			}
			const forEachPattern = ()=>forEachTree(context,v=>v?.list??[]);
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
				if(argParentIndex==-1){
					throw Error("compiler error");
				}
				if(!higherParamParent)throw Error("compiler error");
				let higherArgParent = match_parents[argParentIndex-1];
				if(argParentIndex==0){//e.g. '(a a=2)'
					//UNTESTED: unknown behaviour: may not reference errors, where there should be
					return;
				}
				if(!higherArgParent)throw Error("compiler error");
				if(higherParamParent.parent!=higherArgParent.parent)throw Error("compiler error");
				{//check for and prevent reference loops
					if(higherParamParent.refs?.has?.(higherArgParent))match.id.throwError("illegal reference", "recursive/self reference, detected using label '"+match.arg+"'. These are not allowed",a=>Error(a))
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
				if(higherArgParent.refLevel<=higherParamParent.refLevel)match.id.throwError("illegal reference", "complex recursive/self reference, detected using label '"+match.arg+"'. These are not allowed",a=>Error(a));
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
				constructor(name,priority,foo,length=2){
					//assume this.name[1] is not used
					super({name:[name,undefined],priority,owner:context,value:foo});
					this.value.operatorParamObj = this;//:truthy
					this.length = length;
				}
				isParsed=false;
				//name:[String,Number]
				//index:Number
				//owner:Pattern
				//value:Lazy
				//priority:Number
				//length:Number
			}
			let maxPriority;
			{
				//applies to Patterns with type = "operator"
				context.value = new Lazy;
				const bool_true = new class True extends Lambda{}(new Lambda(1));
				const bool_false = new class False extends Lambda{}(new Lambda(0));//new Int(0);
				const equality = (a,b)=>//(Exp,Exp)-> Lambda bool
					(a=a.eval())==(b=b.eval())?bool_true
					:a instanceof Array?
						!(b instanceof Array)?bool_false
						:!(a.constructor == b.constructor)?bool_false
						:a.length != b.length?bool_false
						:a.reduce((s,v,i)=>s==bool_false?s:equality(a[i],b[i]),bool_true)
					:b instanceof Array?equality(b,a)
					:+a==+b?bool_true//assume: NaN!=NaN
					:bool_false
				;
				let i=0;
				context.startLabels= new Map([
					["!" ,  i,new Lambda(0,bool_false,bool_true)],//new ArrowFunc((a,context,stack)=>Lazy.toInt(a,stack)==0||a==Lambda.null?bool_true:bool_false),1],
					["~" ,  i,new Calc((a)=>~a),1],
					["++",  i,new Calc((a)=>a+1,new MultiArgLambdaFunc(([a,f,x],c,s)=>f.call(a.call(f,c,s).call(x,c,s),c,s),3)),1],
					["--",  i,new Calc((a)=>a-1),1],
					["&" ,++i,new Calc((a,b)=>a&b),2],
					["|" ,  i,new Calc((a,b)=>a|b),2],
					["^" ,  i,new Calc((a,b)=>a^b),2],
					["%" ,  i,new Calc((a,b)=>a%b),2],
					["**",  i,new Calc((a,b)=>a**b,new MultiArgLambdaFunc(([a,b],context,stack)=>b.call(a,context,stack),2)),2],
					["*" ,++i,new Calc((a,b)=>a*b,new MultiArgLambdaFunc(([a,b,f],c,s)=>
						a instanceof List && b instanceof List ?Object.assign(new List(...a,...b),{id:a.id}):
						a instanceof StringExp && b instanceof StringExp ?Object.assign(new StringExp(a+b),{id:a.id}):
						a.call(b.call(f,c,s),c,s),3)
					),2],
					["/" ,  i,new Calc((a,b)=>a/b),2],
					["+" ,++i,new Calc((a,b)=>a+b,new MultiArgLambdaFunc(([a,b,f,x],c,s)=>a.call(f,c,s).call(b.call(f,c,s).call(x,c,s),c,s),4)),2],
					["-" ,  i,new Calc((a,b)=>a-b),2],
					["==",++i,new ArrowFunc(a=>new ArrowFunc(b=>equality(a,b))),2],
					["<" ,  i,new Calc((a,b)=>a<b?bool_true:bool_false)],
					[">" ,  i,new Calc((a,b)=>a>b?bool_true:bool_false)],
					[">=",  i,new Calc((a,b)=>a>=b?bool_true:bool_false)],
					["<=",  i,new Calc((a,b)=>a<=b?bool_true:bool_false)],
					["&&",++i,new Lambda(new Lambda(1,0,1)),2],
					["||",  i,new Lambda(new Lambda(1,1,0)),2],
					["^^",  i,new Lambda(new Lambda(1,[0,bool_false,1],0)),2],
				].map(v=>[
					[
						files.addInbuilt(v[2],v[0]),
						v[2][0]instanceof Lambda?files.addInbuilt(v[2][0],v[0]):undefined,//add ID's to the `Lambda(Lambda())` operators
						v[2].name=v[0],
						v[2] instanceof Calc &&v[2].fallBackExp!=undefined?files.addInbuilt(v[2].fallBackExp,v[0]):undefined,
						v=new Operator(...v),
					][4].name[0],
					v
				]));
				let name = "Infinity";
				context.startLabels.set(name,new Param({name:[name,undefined],owner:new BracketPattern({parent:context}),value:RecurSetter.forever}));
				maxPriority= i;
			}
			function parseNumber(word){
				let base = word[1]=="b"?2:word[1]=="x"?16:10;
				return !isNaN(+word)?+word:(([a,b])=>+a+b/base**b.length)(word.split("."));
			}
		//----
		//mutates context
		passes:{
			//getAssignments:
			//find definisions
			for(let [match,i,bracketParent] of forEachPattern()){
				match.funcLevel = match.parent?.funcLevel || 0;
				if(match.parent.pattern == "::" && i==0)match.funcLevel--; //'r' does use the inner '::' context
				let lastValue = match.isFirst?undefined:bracketParent[i-1];// ','
				if(match.pattern == "="){//assignment
					if(bracketParent.pattern==","){
						{//set up assignment properties
							bracketParent.startLabels ??= new Map();//String|Number => Param
							bracketParent.currentLabels ??= new Map();
							bracketParent.refs ??= new Set();//:Set(BracketPattern) where p.refs.get(x).refs.get(p) == undefined
						}
						bracketParent=bracketParent.parent;
					}
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
				else if(match.type == "recursion"){
					match.value = new RecurSetter();
					match.funcLevel++;
				}
				else if(match.pattern == "."){
					match.value = [NameSpace.get];//args are added in the next pass
				}
				else if(match.pattern == "()="){//with/use
					match.value = bracketParent.value;
				}
				else if(match instanceof BracketPattern){
					if(match.pattern=="()" || match.pattern == ","){
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
			//assert:'a.b' -> '(. a b)'
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
				else if(match.type == "argument" || match.type == "symbol" || match.type == "number" || match.type == "string"){
					if(match.pattern == "$"){
						match.value = parseNumber(match.params[0][0]);
						if(typeof match.value == "number"){//lambda parameter
							//validate value
							if(match.value>match.funcLevel){
								match.id.throwError("reference", "the parameter number exceeds the amount of global scopes",a=>Error(a));
							}
						}
					}
					else{
						//match.value may be defined if it's a '(.)'
						let {param,parents} = getParam(match.arg,match.parent)??{};
						if(match.type=="number"){
							if(!param){//if not overwritten && is number literal '1'
								match.value = new Int(parseNumber(match.arg));
							}
						}
						else if(match.type=="string"){
							if(!param){
								let string = parseString(match.arg);
								match.value = Object.assign(new StringExp(string),{id:match.id});
							}
						}
						if(match.value == undefined) {
							//note: number literals & other predefined values can be used as either an Int or a parameter reference
							if(!param){
								match.id.throwError("reference", "label: '"+match.arg+"' is undefined",a=>Error(a));
							}
							addRefParam(match,parents,param);
							//assert: param != undefined
							match.ref = param;
							if(param.owner.type == "function"){
								let refLevel = match.funcLevel-param.owner.funcLevel;
								if(param.owner.options[0]=="{"){//is multi assign namespace
									match.value = [NameSpace.get,refLevel,new StringExp(param.name[0])];
								}
								else if(param.owner.options[0]=="["){//is multi assign list
									match.value = [List.get,refLevel,new Int(param.index)];
								}
								else{
									match.value = refLevel;
								}
								match.value.id = match.id;
							}
							else if(param.owner.type == "assignment"){
								const paramValue = param.value;
								const levelDif = match.funcLevel-param.owner.funcLevel;
								match.value = new Reference(paramValue,levelDif,match.id);
							}
							else{
								match.value = param.value;
							}
							if(match.value==undefined)throw Error("compiler error");
						}
					}
					match.parent.value.push(match.value);
				}
				else if(match.type=="recursion"){
					match.parent.value.push(match.value);
				}
				else if(match.pattern == "."){
					match.parent.value.push(match.value);
					//will add the other 2 arguments for the dot operater in the next iteration of this loop.
				}
				else if(match instanceof BracketPattern){
					match.parent.value.push(match.value);
				}
			}
			
			//finds recursion pattern 'r' in 'r :: a'. Also parses 'a.b' where b is a label
			for(let [match,i,bracketParent] of forEachPattern()){
				if(match.pattern=="::"){
					match.value.recur = Object.assign(new Lazy(match.value.shift()),{id:match.list[0].id});
				}
				else if(match.pattern=="." && match.params?.length==1){
					let [word,id] = match.params[0].name;
					if(match.options == "number"){
						match.value[0] = List.get;
						match.value.push(Object.assign(new Int(parseNumber(word)),{id}))
					}
					else if(match.options == "property"){
						//assume: match.value[0] == NameSpace.get
						match.value.push(Object.assign(new StringExp(word),{id}));
					}
				}
			}
			//remove empty commas caused by assignments e.g. '(a=1,b=2,a)' -> '(a=1,(b=2),(a))' -> '(()(a))' -> '(a)'
			for(let [match,i,bracketParent] of forEachPattern()){
				if(match.pattern==","){
					let index = match.parent.value.indexOf(match.value);
					if(match.value.length == 0 && bracketParent[i+1]?.pattern != ",")//if(match.list.length>0 && match.value.length==0)
						while(match.parent.value.includes(match.value)){
							match.parent.value.splice(index,1);
						}
				}
			}
			//assume: there will be no more empty Expressions

			//handle operator priorities
			for(let [match,i] of 
				function*(){
					yield [context,0];
					yield*forEachPattern()
				}()
			){
				let value = match.value;
				if(!match.list)continue;
				let list = value;
				for(let priority=0;priority<maxPriority+1;priority++){
					for(let i=0;i<list.length;i++){
						//'a+b' -> '((+)a b)'
						//'~a' -> '((~)a) '
						let operator = list[i];
						if(!(operator.operatorParamObj instanceof Operator))continue;
						if(!(operator.operatorParamObj.priority == priority))continue;
						let foo = operator.func;
						let paramLen = operator.operatorParamObj.length;
						let useLeftArg = paramLen == 2;
						if(i<list.length-1)//has right argument
						if(i>0 && !operator.operatorParamObj.isFirst){// '1+' in '1+2' and '1 ++' in '1 ++2' -> '(+ 1 2)' and '1 (++ 2)'
							let newOperation = Object.assign([operator],{id:operator.id});
							let splice=list.splice(i-useLeftArg,paramLen+1);
							newOperation.push(...(paramLen==2?[splice[0],splice[2]]:[splice[1]]));
							let newIndex = i-useLeftArg;
							if(newIndex==0)list.unshift(...newOperation);//prevent: '(1 + 2)' -> '((+ 1 2))'
							else list.splice(newIndex,0,newOperation);
							i-=useLeftArg;
							//'a + b' -> '(+ a b)'
							//'! a' -> '(! a)'
						}
					}
				}
			}
			//remove single commas 'a,b' -> 'a (b)' -> 'a b'
			for(let [match,i,bracketParent] of forEachPattern()){
				if(match.pattern==","){
					let index = match.parent.value.indexOf(match.value);
					if(match.value.length == 1 || index == 0){
						match.parent.value.splice(index,1,...match.value);
					}
				}
			}
			//parse null values and simplify expressions: '()' -> `Lambda.null`
			for(let [match,i,bracketParent] of forEachPattern()){
				if(Lazy.prototype.isReducable(match.value)&& match.value.length==0){
					let index = match.parent.value.indexOf(match.value);
					if(index!=-1)//may of already been removed ealier
					match.parent.value.splice(index,1,Lambda.null);
				}
			}
			if(context.value.length==0)context.value.push(Lambda.null);//
			//check for the empty expression compiler error
			context.value.forEach(function forEach(v,i,a){
				if(v instanceof RecurSetter)forEach(v.recur);
				if(v instanceof Reference)forEach(v.value);
				if(v instanceof NameSpace)v.labels.forEach(v.value);
				if(v instanceof Array){
					if(v.length == 0)throw Error("compiler error:"+console.log(v,i));
					v.forEach(forEach);
				}
			})
		};

		return context;
	}
	let regex =/\s+|\/\/.*|\/\*[\s\S]*\*\/|λ|\b(?:[0-9]+(?:\.[0-9]*)?|0x[0-9a-fA-F]+(?:\.[0-9a-fA-F]*)?|0b[01]+(?:\.[01]*)?)\b|\b\w+\b|"(?:[^"]|\\[\s\S])*"|'(?:[^"]|\\[\s\S])*'|`(?:[^"]|\\[\s\S])*`|::|(?:[!%^&*-+~<>])=|([+\-*&|^=><])\1?|[^\s]/g;
	let lines = text.split("\n");
	const words = text.match(regex)??[];
	const file = new files.FileData({text,words,lines});
	files.list.set(fileName,file);
	const wordsData = [];
	words.reduce((s,v,i)=>{
		s.word = v;
		wordsData.push(s);
		s = new WordData(s);//assume: this creates a new object
		if(v.match("\n")){
			s.line += (v.match(/\n/g)?.length??0);
			s.column = (v.match(/(?<=\n).+$/)?.[0]?.length??0)+1;//assume: column >= 1
		}
		else s.column+=v.length;
		return s;
	},new WordData({line:1,column:1,fileName,file,word:"",maxRecur:Infinity}));
	let main=()=>{
		const tree = treeParse(wordsData);
		const context = parseContexts(tree);
		const expression = context.value;
		Object.assign(file,{tree,context,expression})
		return file;//parse(tree);
	}
	return main();
}
function tryCatch (foo,throwError,exceptionValue){
	throwError??=console.log;
	if(TEST){
		return foo();
	}
	else try{//main
		return foo();
	}catch(error){
		throwError(error);
		return exceptionValue;
	}
}
//bug: 'a = b = 1' -> null error
tryCatch(()=>{//λ
	let s = new Stack;
	compile(`
		log>eval>toJS>(
			a = [1 2 3],
			log (
				toJS(
					eval(
						Infinity::(
							a.reduce([s v]>s+v)
						)
					)
				)
			)
		)
	`)
	.call(new ArrowFunc((v,c,stack)=>[loga(v[Exp.symbol]?v.eval(stack):v),v][1]))
	.call(new ArrowFunc((v,c,s)=>v.evalFully(s)))
	.call(new ArrowFunc((v,c,s)=>v[Exp.symbol]?v.eval(s).toJS():v))
	//.evalFully()
});