//TEST IMPURE UNTESTED TODO
const TEST = false;
//TODO:
//- Make NameSpace an instance of Exp_Array, where nameSpace[0] is its expression
//- Implement replace `nameSpace .exp` with `namespace[0]`
//- Make Constext contain an array of all the parent contexts referenced by the Lazy expressions.
//- Replace evalFully() with a partial evaluation system.
//- Fix bug: allow '[f1 a, f2 b]' -> '[(f1 a) (f2 b)]' instead of '[f1 a (f2 b)]'
//BODGED
{//compile,files,JSintervace
	//classes
		//Exp: Lambda'λ' | Lazy'()' | Recur'::'
		//OutExp: Lazy
		class Exp{
			//id:WordData
			call(arg,context,stack){return stack.doOnStack(this,arg,stack=>this.eval(stack).call(arg,context,stack))}
			eval(stack){return this}//lazy evaluatuation
			evalFully(stack){return (this instanceof Lazy?this:new Lazy(this)).evalFully(stack)}//non-lazy evaluation
			toJS(){return Object.assign((...args)=>args.reduce((s,v)=>s.call(v),this),{})}
			static eval(exp,ownerExp,stack=new Stack,reps=1){
				for(let i=0;i<reps;i++)
					exp=exp?.[Exp.symbol]?stack?stack.doOnStack(ownerExp,exp,stack=>exp.eval(stack)):exp.eval():exp;
				return exp;
			};
			static evalFully(exp,stack=new Stack){
				return new Lazy(exp).evalFully(stack);
			};
			static isSearched = Symbol();
			static toJS(exp){return exp?.[Exp.symbol]?exp.toJS():exp}
			static fromJS(value,recursiveLevel=-1,fileName){//:Exp
				const addId = v=>Object.assign(v,{id:new WordData({fileName})});
				let ans;
				switch(typeof value){
					case"function":ans = new Func(value);break;
					case"number":ans = value===(value|0)?new Int(value):new Float(value);break;
					case"string":ans = new StringExp(value);break;
					case"undefined":ans = Lambda.null;break;
					case"boolean":return new Lambda(new Lambda(value?1:0));break;
					case"object":
						if(value==null)return Lambda.null;
						if(recursiveLevel>0)value[this.isSearched]=true;
						ans =  
							value[Exp.symbol]?value:
							recursiveLevel-- <= 0?new JSWrapper(value):
								value instanceof Array?new List(...(recursiveLevel>0?value.map(v=>Exp.fromJS(v,recursiveLevel-1,fileName)):value)):
								new NameSpace((obj=>{
									let newMap=new Map;
									for(let i in obj)newMap.set(i,!obj[i]?.[this.isSearched]&&recursiveLevel>0?this.fromJS(obj[i],recursiveLevel-1,fileName):obj[i]);
									return newMap;
								})(value))
						;
						if(ans.id==undefined)ans.id = addId(ans);
						if(recursiveLevel>0)if(value)delete value[this.isSearched];
					break;
				}
				return ans == Lambda.null?ans:addId(ans);
			}
			static symbol = Symbol("is expression");
			//labels:Map(string=>Exp);
		}
		class Exp_Array extends Array{
			//note without this custom map method: this.map would first call 'new Lazy(this.length)', which is only overwriten if there is at least 1 item in the expression.
			map(foo){return this.length==0?new this.constructor():Array.prototype.map.call(this,foo);}
		}
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
				eval(stack = new Stack,context = new Context(undefined,undefined,1)){return this.value.eval(stack,context)??Lambda.null}
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
		//type ID : WordData
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
						+stack.map(id=>id?.displayWordInLine?.("at")??"").join("\n")
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
			labels;//:Map(string=>Reference)? ; if this exists then namespace-like labels are added to the expressiong when evaluated.
			isList;//:bool; true=>'[]' , false=>'()'
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
			static isTypeReducible(exp){//returns to if exp.eval() != exp ; note doesn't include `(&& !exp.labels)`
				//isLazyEvalType
				return exp instanceof Lazy || exp instanceof Reference || exp instanceof RecurSetter;
			}
			static isReducible(exp){
				return !exp?.[Exp.symbol]?false:
					exp instanceof NameSpace?exp.exp instanceof NameSpace||exp.exp instanceof JSWrapper||this.isReducible(exp.exp):
					//exp?.constructor == Array?(!exp.isList && !exp?.labels):
					exp instanceof AsyncExp?exp.isReducible():
					exp instanceof Lazy?!(exp.length==1 && exp[0] instanceof Lambda && !exp.isList && !exp.labels):
					exp instanceof RecurSetter||this.isTypeReducible(exp);
			}
			isSimplyReducible(exp){//exp:Exp|Array|any ; returns true if exp is valid to be parsed as `ans` in the `ans.map` part of `Lazy.prototype.eval``.
				return (exp?.constructor == Array||exp instanceof Lazy) && exp.length==1 && (!exp.isList && !exp.labels) && (exp[0]?.constructor == Array||exp[0] instanceof Lazy);
			}
			//static isReducible(exp){return (exp instanceof Lazy || exp.constructor==Array &&!exp.labels)}
			eval(stack=new Stack()){
				const context = this.context??new Context();
				let startExp = this;
				let ans = this;
				{
					//[x],Lazy(x),1::x -> x; where x:Lazy|Array|RecurSetter
					while(this.isSimplyReducible(startExp))startExp=startExp[0];//assume: startExp is Tree
					//startExp:Lazy|Array
					if(startExp.length == 0 && !startExp.labels&&!startExp.isList)
						if(1)throw Error("compiler error: all null values should be delt with at compile time");
						else return Lambda.null;
				}
				ans = startExp.map(v=>//[]->{call:(arg:Lazy,Stack)->Combinator|Lazy&{call:(Exp,Context,Stack,Number)->Lazy}}[]
					typeof v == "number"?context.getValue(v):
					typeof v == "string"?v://simple raw string cannot be called
					//typeof v == "string"?:
					v instanceof Lambda?Object.assign(new Lazy(v),{context,id:v.id}):
					v instanceof RecurSetter?v.context?v:Object.assign(new RecurSetter(...v),{...v,context,id:v.id}):
					v instanceof Reference?Object.assign(new Lazy(...v),{id:v.id,context:context.getContext(v.levelDif)}):
					v instanceof Lazy?v.context?v:Object.assign(new Lazy(...v),{...v,context}):
					v instanceof Exp||
					v instanceof Exp_Array||
					v instanceof Exp_String||
					v instanceof Exp_Number?v:
					v instanceof Array?Object.assign(new Lazy(...v),{context,id:v.id??this.id,isList:v.isList,labels:v.labels}):
					/*v instanceof Object?(v=>{
						let labels=new Map();
						for(let i in v){
							labels.set(i,Object.assign(new Lazy(v[i]),{}));
						}
						return new NameSpace(labels);
					})(v):*/
					v//uncallable object
				);
				//if(!startExp.id)throw Error("compiler error: list or lazy expression without an id");
				ans = startExp.isList?Object.assign(new List(...ans),{id:ans.id||this.id}):
					ans.reduce((s,v,i)=>stack.doOnStack(s,v,stack=>s.call(v,context,stack)))
				;
				if(startExp.labels){
					let newLabels = new Map();
					for(let [i,v] of startExp.labels){
						newLabels.set(i,Object.assign(new Lazy(v),{context}).eval(stack));
					}
					ans = Object.assign(new NameSpace(newLabels,ans),{id:ans.id});
				}
				if(ans!=this){//optimise for next time.
					this.splice(0,this.length,ans);
					this.labels = undefined;
					this.isList = undefined;
				}
				return ans;
			}
			//; Lazy.evalFully
			evalFully(stack=new Stack()){
				let ans = this;
				let bail =100000;
				while(Lazy.isReducible(ans)&&bail-->0)
					ans = ans.eval(stack);
				if(bail<=0)throw Error("possible compiler error: bailled. may be caused by:"
					+"1. A compiler bug: probably within the Lazy.isReducible function, or somethere else in the code"
					+"2. An expression that takes many steps to evaluate;"
					+"3. An expression that cannot be fully reduced (i.e. one that does not have a reduced form)"
				);
				return ans;
			}
			toInt(foo,stack){//foo:{call(inc)->{call(0)->Number}}
				return this.constructor.toInt(foo,stack);
			}
			static toInt(foo,stack=new Stack){//foo:{call(inc)->{call(0)->Number}}
				//if(Lazy.isReducible(foo))return new Lazy(Exp.eval(foo,foo,stack,1));
				foo = Exp.fromJS(foo);
				foo = foo.evalFully(stack);
				if(foo instanceof Float)return foo;
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
				toJS(){return null}
			};
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
				let ans = stack.doOnStack(this,this.recur,stack=>Lazy.toInt(Object.assign(new Lazy(...this.recur),{id:this.recur.id,context:this.context}),stack));
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
		class Reference extends Exp_Array{//wrapper for Lazy
			constructor(value){
				super(1);
				this[0]=value;
			}
			//value:Exp
			levelDif//:Number
			id//:WordData
			get value(){return this[0]}
			set value(v){this[0]=v}
			call(arg,context=new Context,stack){
				//context??= new Context();
				stack.unshift(this.id);
				let value = new Lazy(...this);
				value.id = this.id;
				value.context=context.getContext(this.levelDif);
				let ans = value.call(arg,context,stack);
				stack.shift();
				return ans;
			}
			eval(stack){return this[0].eval(stack);}
			toJS(){return this[0].toJS?.()}
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
			doOnStack(foo,arg,func){//arg:Exp|Any,foo:Exp|Any
				let stackableObjects = [foo,arg];//expression that will be added onto the stack.
				const data = foo.id;
				let oldMaxRecur = data?.maxRecur;
				let recurs = {value:0};//
				if(!this.#add(foo,arg,recurs)){//recurs:mut
					recurs = recurs.value;
					//note: stack.add already removes the lambda from the stack, so it does not need to be done here.
					//recursion detected
					if(1){
						data.throwError("recursion", "unbounded recursion detected. Recursion level: "+recurs+"",a=>Error(a),this);
					}else return Lambda.null;
				}else {}
				let ans = func(this);
				this.#remove(foo,arg);
				if(data)data.maxRecur = oldMaxRecur;
				return ans;
			}
			#add(exp,arg,recurs_out){
				this.unshift(arg?.[Exp.symbol]?arg.id:undefined);
				let id = exp.id;
				if(id!=undefined){
					this.unshift(id);
				}
				else return true;
				if(1)return true;//TESTING: stack system sometimes doesn't work for unknown reasons
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
				//recurs = [...stackStr.matchAll(matchStackStr)].length;
				if(1){
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
				constructor(func,len,args=[],id){
					super()
					this.func = func;//:(...Number[])->Number
					this.len = len;
					this.args = args;//:Lazy[]
					this.id = id;
				}
				//isOperater:bool&Operator?
				call(arg,context,stack){//Int->Int-> ... Int-> Int
					if(this.args.length>=this.len-1)
						return this.func([...this.args,arg],context,stack);
					else return Object.assign(new this.constructor(),{...this,args:[...this.args,arg]});//TODO: add separate id's for different parts of the function.
				}
				toJS(){return (...args)=>this.func([...args])}
			}
			class Func extends MultiArgLambdaFunc{
				constructor(func,len,args=[],stack=undefined){
					super(func,func?.length);
				}
				call(arg,context,stack){//Int->Int-> ... Int-> Int
					if(this.args.length>=this.len-1)
						return Exp.fromJS(this.func(...[...this.args,arg].map(v=>Exp.toJS(Exp.evalFully(v,stack))),context,stack));
					else return Object.assign(new this.constructor(),{...this,args:[...this.args,arg]});//TODO: add separate id's for different parts of the function.
				}
				toJS(){return this.func}
			}
		class JSWrapper extends Exp{//for getting properties from
			constructor(value){super();this.value = value}
			#value;
			get value(){return this.#value};//:Object
			set value(v){this.#value = v}
			call(arg,context,stack){
				return typeof this.value=="function"?Exp.fromJS(this.value(arg)):Lambda.null;
			}
			toJS(){return this.value}
		}
		class NameSpace extends Exp{//'{a b c}' and '{a<=1,b<=2,c<=3}'
			constructor(labels,exp,id){//labels:Map(string,Exp)|JSON-like object
				super();
				if(!(labels instanceof Map)){
					this.labels=new Map();
					for(let i in labels){
						this.labels.set(i,labels[i]);
					}
				}
				else this.labels = labels;
				this.exp = exp;
			}
			labels;//labels:Map(string,Exp)
			exp;//: Exp?
			call(arg,context,stack){
				if(Lazy.isReducible(this))return this.evalFully().call(arg,context,stack);
				if(this.exp)return this.exp.call(arg,context,stack);//{a>a a} x -> (a>a a) x
				if(arg instanceof NameSpace)return new NameSpace(new Map([...this.labels,...arg.labels]),arg.exp);
				else return new NameSpace(this.labels,arg);
			}
			eval(stack){
				stack??=new Stack();
				//if(!Lazy.isReducible(this.exp))return this;
				let exp=stack.doOnStack(this,undefined,stack=>Exp.eval(this.exp,stack));
				if(exp instanceof NameSpace)return new NameSpace(new Map([...this.labels,...exp.labels]),this.exp.exp);
				if(exp instanceof JSWrapper){if(exp.value!=undefined)this.labels.forEach((v,i)=>exp.value[i]=Exp.toJS(Exp.evalFully(v,this,stack)));return exp}
				return new NameSpace(this.labels,exp);
			}
			toJS(){
				let newObj = {};
				for(let [i,v] of this.labels){
					newObj[i]=!v?.[Exp.symbol]?v:v.evalFully().toJS()??v;
				}
				let value = this.exp?.[Exp.symbol]?this.exp.evalFully().toJS():this.exp;
				if(this.exp==undefined||this.exp==Lambda.null)return newObj;
				else return Object.assign(value,newObj)
			}
			static get = new class NameSpace_Get extends MultiArgLambdaFunc{}(function get([obj,property],context,stack){
				loga("??",property)
				stack.doOnStack(this,obj,stack=>{
					obj = obj.evalFully(stack);
				});
				stack.doOnStack(this,property,stack=>{
					property = property.evalFully(stack);
				});
				getIndex:if(property instanceof Float){
					if(obj instanceof List)return obj[property|0]??List.null;
					if(obj instanceof NameSpace)break getIndex;
				}
				else if(!(property instanceof StringExp))return Lambda.null;
				let propertyStr = ""+property;
				if(!obj[Exp.symbol]){
					return Exp.fromJS(obj[propertyStr]);
				}
				if(obj instanceof Func){
					if(propertyStr=="length"){
						return new Int(obj.len);
					}
					else return Lambda.null;
				}
				else if(obj instanceof NameSpace){
					let ans = obj.labels.get(propertyStr);
					if(ans)return ans;
					if(obj.exp)return get([obj.exp,property],context,stack);
					if(!ans)return Lambda.null;
				}
				else if(obj instanceof List){
					if(propertyStr=="length"){
						return new Int(obj.length);
					}
					if(List.methods.has(propertyStr))return List.methods.get(propertyStr).call(obj,context,stack);
				}
				else if(obj instanceof JSWrapper){
					let ans = obj.value?.[propertyStr];
					if(typeof ans == "function")ans = ans.bind(obj.value);
					return Exp.fromJS(ans);
				}
				return Lambda.null;
				obj instanceof List ||
				obj instanceof Float ||
				obj instanceof StringExp
				Lambda.null
			},2);
			static assign_id = new FilelessWordData({word:"assign part"});
			static set = new class NameSpace_Set extends MultiArgLambdaFunc{}(function([nameSpace,property,value],context,stack){
				return stack.doOnStack(new Exp({id:NameSpace.assign_id}),undefined,stack=>{
					const tryAgain = ()=>new Lazy(new this.constructor(this.func,this.len,[nameSpace,property],this.id),value);
					if(Lazy.isReducible(property))property = stack.doOnStack(NameSpace.assign_id,property,stack=>property.eval(stack));
					if(!(property instanceof StringExp || property instanceof Float))return nameSpace;
					if(Lazy.isReducible(property))return tryAgain();
					else {
						if(property instanceof Float && !(nameSpace instanceof NameSpace)){
							property = +property;
							if(Lazy.isReducible(nameSpace))nameSpace = stack.doOnStack(NameSpace.assign_id,nameSpace,stack=>nameSpace.eval(stack));
							if(Lazy.isReducible(nameSpace))return tryAgain();
							if(nameSpace instanceof List){
								let newList = Object.assign(new List(...nameSpace),{id:nameSpace.id});
								if(!isNaN(property)&&Math.abs(property)!=Infinity&&property>=0)newList[property|0] = value;
								return newList;
							}
							else return Lambda.null;
						}
						else if(property instanceof StringExp){
							//asseert: nameSpace:NameSpace|reducable expression
							let propertyStr = ""+property;
							nameSpace = Exp.evalFully(nameSpace,stack);
							if(!(nameSpace instanceof NameSpace))return new NameSpace(new Map([[propertyStr,value]]),nameSpace,property.id);
							let newObj = new NameSpace(new Map(nameSpace.labels),nameSpace.exp,property.id);
							newObj.labels.set(propertyStr,value);
							return newObj;
						}
						return Lambda.null;
					}
				});
			},3)
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
					for(let i = 0;i<this.value&&i<1000000;i++){
						ans = this.arg_f.call(ans,context,stack);
						if(i+1>=1000000)throw Error("bailed");
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
				if(Exp.eval(arg_f,this) instanceof Float)return new this.constructor(arg_f**this);
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
				if(args.length>=this.func.length){
					const ans = this.func(...args.map(v=>+Lazy.toInt(v,stack)));
					const nullValue = Lambda.null;
					return typeof ans == "number"?
						isNaN(ans)?
							this.fallBackExp?
								args.reduce((s,v)=>s.call(v),this.fallBackExp)
								:nullValue//args.reduce((s,v)=>s.call(v,context,stack),this.fallBackExp)
							:(ans|0)==ans?new Int(ans):new Float(ans)
						:ans??nullValue
					;//can return custom Exp objects.
				}
				return new this.constructor(this.func,this.fallBackExp,[...this.args,arg],stack)
			}
			eval(stack){return this}
		}
		class List extends Exp_Array{
			//linked list. '[x y]' -> 'end> bool>a x bool>bool y end'
			constructor(...list){
				super(list.length);
				Object.assign(this,list);
			}
			end;//:Exp?
			static falseExp = Object.assign(new Lambda(Object.assign(new Lambda(0),new FilelessWordData({word:"const"}))),new FilelessWordData({word:"false"}));//TODO: add IDs
			static getTailExp = new MultiArgLambdaFunc(([list],c,s)=>list.call(this.falseExp,c,s),2,[],new FilelessWordData({word:"list.getTail"}));
			getItem(index,context,stack){
				let end;
				const defaultExp = ()=>index.call(List.getTailExp,context,stack);
				return stack.doOnStack(this,stack=>
					index instanceof Float?
						index|0<this.length?this[index|0]:
						(this.end=end.evalFully()) instanceof List?end.getItem(new Int(index-this.length),context,stack):
						defaultExp()
					:defaultExp()
				);
			}
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
					if(this.#list.length == 1)tail = this.#end;
					else{
						tail = new this.constructor([...this.#list],this.#end,this.id);
						tail.#list.shift();
					}
					return bool.call(head,context,stack).call(tail,context,stack);
				}
			}
			call(arg,context,stack){
				let id = this.id;
				return new this.constructor.#ListWithEnd(this,arg,id);
				//this.constructor.concat.call(this,context,stack).call(arg,context,stack);
			}
			eval(){return this}
			toJS(){return [...this.map(v=>v[Exp.symbol]?v.evalFully().eval().toJS():v)]}
			static null = new class EndOfList extends Exp{
				toJS(){return null};
				call(){return this}
			}//a>(a>b>a a,a>b>a a)
			static toList(exp,stack){
				exp = Exp.evalFully(exp,stack);
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
				([list,foo],context,stack)=>stack.doOnStack(List.map,foo,stack=>
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
				([list,foo,startingState],context,stack)=>stack.doOnStack(List.forEach,foo,stack=>
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
				([list,foo],context,stack)=>stack.doOnStack(List.map,foo,stack=>
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
		class AsyncExp extends Exp{
			//may be UNFINISHED
			//mainly for importing files
			constructor(promise,callList,id){
				super();
				this.id = id??undefined;
				this.promise = promise;
				promise.then(value=>{
					this.value = value;
					this.isReducible = true;
				});
				this.callList = callList??[];
			}
			id;//:ID
			value = undefined;//:Exp?
			isReducible=false;//:bool ; is set to true when the promise resolves.
			call(arg,context,stack){
				if(this.isReducible)return stack.doOnStack(this,arg,stack=>[...this.callList,arg].reduce((s,v)=>s.call(v,context,stack),this.value));
				else return new this.constructor(this.promise,[...this.callList,arg]);
			}
			eval(stack){
				if(this.isReducible)return stack.doOnStack(this,arg,stack=>value.call());
				else return this;
			}
		}
		{
			let globals = (()=>{
				let obj = {};
				try {obj["window"]=window;} catch(e){}
				try {obj["process"]=process;} catch(e){}
				try {obj["global"]=global;} catch(e){}
				for(let i in obj)obj[i]=Exp.fromJS(obj[i]);
				return obj;
			})();
			var JSintervace = new NameSpace({
				...globals,
				//"new":new MultiArgLambdaFunc(()),
			});
		}
		for(let [i,v] of JSintervace.labels)
			if(v!=Lambda.null)v.id = new FilelessWordData({word:"SOURCE: JS intervace: "+i});
		{//old unued code
			//const Y = new Lambda(new Lambda(0,0),new Lambda(new Lambda(2,0),[0,0]));
			let Y = new Lambda(new Lambda(1,[0,0]),new Lambda(1,[0,0]));
			let vec2 = new Lambda(new Lambda({x:1,y:0}));//x>y>{x y}
			let recur = new Lambda();
		}
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
			[RecurSetter.forever,"forever"],
			[RecurSetter.forever[0],"forever"],
			[NameSpace.get,"get"],
			[NameSpace.set,"set"],
		].forEach(v=>files.addInbuilt(...v));
	}
	{
		//compiler classes
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
					publicLabels;//:?Param[]
					list;
					//
					usingLabels;//:?string[] if '()>'|Map(String,Param) if '()=>'; for '()>' and '()=>'
			}
			let num=0;//is for TESTING and debugging only
			class BracketPattern extends Pattern{
				constructor(data){super();this.num = num++;Object.assign(this,data);}
				num=0;
				parent;
				pattern='()';//'()'|'[]'|'{}'
				list=[];//:Tree<Pattern> ; brackets only
				id;//:WordData
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
			class Pattern_extra{
				//BracketPattern
					startLabels;//:Map(String,Ref)
					currentLabels;//:Map(String,Ref)
					publicLabels;//:Map(String,Ref)?
					refs;//:Set(Pattern) & Tree(Pattern)
				refLevel;//:Number
				funcLevel;//:Number ; number of nested lambdas
				//on '=' only
					isUsed;//:bool ; For assignment patterns only. Is true if at least one reference to this label exists.
				//on 'a.b=' only
					firstValue;//:simple|null
				//on '()=' only
					withBlock_isLeftArg;//:bool ; 
				//used by the `refs` object only
					//refs:Map(Pattern&!Simple => Simple[])
					//isSearched:bool,
					//pathNumber:Number,

			}
			class Param{
				constructor(data){Object.assign(this,data)}
				name;//:[String,ID] ; name of the parameter or label, where `name[0]==name[1].word`
				index;//:number ; if a pattern has muli parameters it shows which one it is.
				owner;//: Pattern & context with a {list:Array} ; is the expression that the label bellongs to
				value;//: Lazy? ; only for assignment patterns
			}
			class Operator extends Param{
				static owner = new BracketPattern({id:new FilelessWordData({word:"operator"})});
				constructor(name,priority,foo,length=2){
					//assume this.name[1] is not used
					super({name:[name,undefined],priority,owner:Operator.owner,value:foo});
					this.value.operatorParamObj = this;//:truthy
					this.length = length;
				}
				toJSON(){return "operator:"+this.name};
				isParsed=false;
				//name:[String,Number]
				//index:Number
				//owner:Pattern
				//value:Lazy
				//priority:Number
				//length:Number
			}
		//----
		const globalContext = new BracketPattern;
		let maxPriority;
		assignGlobal:{
			//applies to Patterns with type = "operator"
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
			const assign_id = new FilelessWordData({word:"="});
			Operator.owner.startLabels=Operator.owner.publicLabels = new Map([
				["!" ,  i,new Lambda(0,bool_false,bool_true)],//new ArrowFunc((a,globalContext,stack)=>Lazy.toInt(a,stack)==0||a==Lambda.null?bool_true:bool_false),1],
				["~" ,  i,new Calc((a)=>~a),1],
				["++",  i,new Calc((a)=>a+1,new MultiArgLambdaFunc(([a,f,x],c,s)=>f.call(a.call(f,c,s).call(x,c,s),c,s),3)),1],
				["--",  i,new Calc((a)=>a-1),1],
				["&" ,++i,new Calc((a,b)=>a&b),2],
				["|" ,  i,new Calc((a,b)=>a|b),2],
				["^" ,  i,new Calc((a,b)=>a^b),2],
				["%" ,  i,new Calc((a,b)=>a%b),2],
				["**",  i,new Calc((a,b)=>a**b,new MultiArgLambdaFunc(([a,b],context,stack)=>b.call(a,context,stack),2)),2],
				["*" ,++i,new Calc((a,b)=>a*b,new MultiArgLambdaFunc(([a,b],c,s)=>//a>b>f>a (b f)
					a instanceof List && b instanceof List ?Object.assign(new List(...a,...b),{id:a.id}):
					a instanceof StringExp && b instanceof StringExp ?Object.assign(new StringExp(a+b),{id:a.id}):
					new ArrowFunc((f,c,s)=>a.call(b.call(f,c,s),c,s),{id:a.id})
				,2),2)],
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
				["=" ,  i,new MultiArgLambdaFunc(function([nameSpace,property,value],context,stack){
					if(Lazy.isReducible(property) )property = property.eval(stack);
					if(!(property instanceof StringExp || property instanceof Float))return nameSpace;
					if(Lazy.isReducible(nameSpace))nameSpace = nameSpace.eval(stack);
					if(Lazy.isReducible(nameSpace)||Lazy.isReducible(property))
						return Object.assign(new Lazy(this,nameSpace.eval(stack),property.eval(stack)),{context,id:assign_id});
					else {
						if(property instanceof Float && !(nameSpace instanceof NameSpace)){
							property = +property;
							if(nameSpace instanceof List){
								let newList = Object.assign(new List(...nameSpace),{id:assign_id});
								if(!isNaN(property)&&Math.abs(property)!=Infinity&&property>=0)newList[property|0] = value;
								return newList;
							}
						}
						else if(property instanceof StringExp){
							property = ""+property;
							if(!(nameSpace instanceof NameSpace))return new NameSpace(new Map([[property,value]]),nameSpace,assign_id);
							let newObj = new NameSpace(new Map(nameSpace.labels),nameSpace.exp,assign_id);
							newObj.labels.set(property,value);
							return newObj;
						}
					}
				},2)]
			].map(v=>{
				files.addInbuilt(v[2],v[0]);
				v[2][0]instanceof Lambda?files.addInbuilt(v[2][0],v[0]):undefined;//add ID's to the `Lambda(Lambda())` operators
				//v[2] = new{[v[0]]:class extends v[2].constructor{}}[v[0]](v[2]);//javascript magic to name the operator classes after the operators themselves.
				v[2].name=v[0];
				v[2] instanceof Calc &&v[2].fallBackExp!=undefined?files.addInbuilt(v[2].fallBackExp,v[0]):undefined;
				v=new Operator(...v);
				return [v.name[0],v];
			}));
			globalContext.startLabels = new Map(Operator.owner.startLabels);
			const addPublics = (parent,value)=>{//map:Map(string => Exp)
				//note: the new `param.owner` can not be the `globalContext`, since that would make references to this would trigger a reference error.
				//for 'with' statements '(import)='
				parent.publicLabels??=new Map;
				for(let [i,v] of value.labels){
					let [name,value]=[i,v];
					let id = new FilelessWordData({word:name});
					let param = new Param({name:[name,id],owner:new Pattern({parent:globalContext,id}),value});
					param.owner.params=[param];
					if(value instanceof NameSpace)addPublics(param.owner,value);
					if(parent.startLabels)parent.startLabels.set(name,param);
					parent.publicLabels.set(name,param);
				}
			}
			const isNodeJS = !globalThis.window;
			let fs;if(isNodeJS)fs=require("fs");
			const importFile = async(type,name,context,stack)=>{
				//UNFINISHED
			};
			const callJS = (foo,args,stack,useNew)=>{
				//assume: args:List
				foo = Exp.evalFully(foo);
				if(foo instanceof Func)foo=foo.func;
				args = List.toList(args);
				if(typeof foo == "function"){
					args = args.map(v=>Exp.toJS(new Lazy(v).evalFully(stack)));
					return Exp.fromJS(useNew?new foo(...args):foo(...args));
				}
				return Lambda.null;
			}
			addPublics(globalContext,new NameSpace(new Map([
				["global",new NameSpace(new Map([
					["Infinity",RecurSetter.forever],
					//["impure",new NameSpace(new Map([
						//functions that would normally return void are 'a>b>b' instead
						["do",new MultiArgLambdaFunc(([value,then],c,stack)=>{value[Exp.symbol]?stack.doOnStack(this,value,stack=>Exp.evalFully(value,stack)):value;
							return then;
						},2)],
						["log",new MultiArgLambdaFunc(([logValue,returnValue],c,stack)=>{
							//uses `eval` instead of `evalFully` so that it is doesn't cause side effects to the Lazy expressions and so it can be used for debugging.
							console.log(logValue[Exp.symbol]?logValue.eval(stack):logValue);
							return returnValue;
						},2)],
						["callJS",new MultiArgLambdaFunc(([foo,args],c,stack)=>{
							//assume: args:List
							return callJS(foo,args,stack,false);
						},2)],
						["callJS_new",new MultiArgLambdaFunc(([foo,args],c,stack)=>{
							//assume: args:List
							return callJS(foo,args,stack,true);
						},2)],
						["js",JSintervace],//'{window eval}=import.std'
						["toJS",new ArrowFunc((v,c,s)=>v[Exp.symbol]?v.eval(s).toJS():v)],
						["toExp",new ArrowFunc((v,c,s)=>Exp.fromJS(Exp.eval(v,{id:undefined},s)))],
					//]))],
					["JSON",Exp.fromJS(JSON,Infinity)],
					["math",new NameSpace(new Map([
						["tau",new Int(Math.PI*2)],
						"E",
						"LN10",
						"LN2",
						"LOG10E",
						"LOG2E",
						"SQRT1_2",
						"SQRT2",
						"abs",
						"acos",
						"acosh",
						"asin",
						"asinh",
						"atan",
						"atan2",
						"atanh",
						"cbrt",
						"ceil",
						"clz32",
						"cos",
						"cosh",
						"exp",
						"expm",
						"floor",
						"fround",
						"hypot",
						"imul",
						"log",
						"log2",
						"log1p",
						"log10",
						"max",
						"min",
						"pow",
						"random",
						"round",
						"sign",
						"sin",
						"sinh",
						"sqrt",
						"tan",
						"tanh",
						"trunc",
					].map(v=>typeof v!="string"?v:[v,Exp.fromJS(Math[v],Infinity)])))],
					["import",new NameSpace(new Map([//UNFINISHED
						["code",new ArrowFunc((name,context,stack)=>{
							let fileString = importFile(name,context,stack);
							return compile(fileString,name);
						})],
					]))],
					["eval",new ArrowFunc((v,c,s)=>v[Exp.symbol]?v.eval(s):v)],
					["evalFully",new ArrowFunc((v,c,s)=>v[Exp.symbol]?v.evalFully(s):v)],
				]))],
			])));
			globalContext.startLabels
			maxPriority= i;
		}
		function compile(text,fileName){
			if(typeof text != "string")throw throwError_noLine("basic API", "'compile' requires a string input as the source code.",a=>Error(a));
			if(fileName=== undefined)fileName=(()=>{
				for(let [fileName,value] of files.list.entries())
					if(value.text == text)return fileName;
				return undefined;
			})();
			function findHighestContext(exp_Array){//UNUSED list:Exp[] ; for memory management. finds the deepest parent referenced by an expression
				return exp_Array.highestContext!=undefined?exp_Array.highestContext:exp_Array.reduce((s,v)=>Math.max(s,typeof v=="number"?v:s.findHighestContext()),-1);
			}
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
					let value = [word,new WordData(data)];//:[String,WordData&ID]
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
					let params=[];//:Tree|[]tree & [String,ID][]
					let hasOwnContext=false;
					let type="operator";
					let oldI=i;
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
								options+=getWord(tree,i)+"..."+getWord(tree,i+2);//"(...)"
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
							word = getWord(tree,i);
							if(word.match(/^<?=>?$/)){options+=word;pattern="=";id=getID(tree,i);type="assignment";++i;}
						}
						if(options.includes("(")&&pattern){//()> or ()=
							if(pattern==">"){pattern = "()>";type = "use";}
							else pattern = "";//else {pattern = "()=";type = "with";}
							hasOwnContext = true;
						}
					}
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
				//extra functions for getAssignments
					function filterTree(v,i,tree){
						return typeof v[0]!="string"||!getWord(tree,i)?.match?.(/^(\s*|\/\*[\s\S]*\*\/|\/\/.*)$/);
					}
					function* forEachTree(context,getTree,extraSycleAtTheEnd){//isTree:node->Tree?
						const tree = getTree(context);
						for(let i=0;i<tree.length;i++){
							let [v,a] = [tree[i],context];
							yield [v,i,a,tree];
							yield*forEachTree(v,getTree,extraSycleAtTheEnd);
						}
						if(extraSycleAtTheEnd)yield[extraSycleAtTheEnd,tree.length,context,tree];
					}
					const forEachPattern = (extraSycleAtTheEnd=null)=>forEachTree(context,v=>v?.list??[],extraSycleAtTheEnd);
					const refs = {
						//type Param:{refs:Set(Param),isSearched:bool,pathNumber:Number},
						graphs:new Set,//:Set(Param) & superset of directed graph heads where (graphs : Param[]) and (graphs[x].refs : Param)
						addReference(higherArgParent,higherParamParent,match){//links param 'a =' to arg 'a'
							{
								//assert: this.graphs will be a superset of all the heads of the graph.
								//note: adding a smart system here that filters Params are added to `this.graphs` would make the program slower
							}
							this.graphs.add(higherArgParent);
							higherArgParent.refs??=new Map;//:Map(Param => Pattern[]);
							let matches;
							if(!(matches = higherArgParent.refs.get(higherParamParent)))higherArgParent.refs.set(higherParamParent,matches=[]);
							matches.push(match);
						},
						checkRefs(){
							//checks for reference cycles (aka loops)
							this.graphs.forEach(v=>function checkGraph(reference,path=[]){//reference:Pattern
								if(!reference.isSearched && reference.refs){
									reference.isSearched = true;
									reference.pathNumber = path.length;
									path.push(reference);
									reference.refs.forEach((matches,assignmentPattern)=>{//assignmentPattern:Pattern
										if(assignmentPattern.pathNumber!=undefined){
											let match = matches[0];
											let loopSize = path.length-assignmentPattern;
											match.id.throwError("illegal reference", "complex recursive/self reference, of size "+loopSize+", detected using label '"+match.arg+"'. These are not allowed",a=>Error(a));
										}
										checkGraph(assignmentPattern,path);
									});
									path.pop(reference);
									reference.pathNumber = undefined;
								}
								//assert: argument has the lowest `argument.refLevel` in the argument's subgraph. Otherwise `throwError` should be called
							}(v));
						}
					};
					function addRefParam(match,match_parents,param){
						//forms a graph of `=` references. This graph is unrelated to the `new Pattern().list` tree.
						//match:Pattern ; references param
						//match_parents:Set(BracketPattern)?
						//param:Param ; points to a parameter in an assignment pattern
						if(!match_parents)return;//assert: if param came from a with statement, it is impossible for it to cause a reference-loop.
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
						{//allows for 'a = b, a b = ()'
							//assume: this case does not contain a reference loop
							//assume: parent.parent.pattern != ","
							if(higherParamParent.pattern=="," || higherArgParent.pattern==","){
								higherParamParent = higherParamParent.parent;
								higherArgParent = higherArgParent.parent;
								if(higherParamParent==higherArgParent)return;
							}
						}
						{//check for and prevent reference loops
							if(higherParamParent.refs?.has?.(higherArgParent))match.id.throwError("illegal reference", "recursive/self reference, detected using label '"+match.arg+"'. These are not allowed",a=>Error(a));
						}
						//adds new reference.
						refs.addReference(higherArgParent,higherParamParent,match);
					}
					function getParam(name,parent,parents=[],stopAtUseBlocks=false){//parents:Pattern[]?
						//Errors:
							//param == null -> was found, but it was a self reference
							//param == undefined -> not found at all
							//param == NaN -> not found, caught bty 'use' block
						//----
						const checkForSelfRef = p=>p?parents.includes(p?.owner)?null:p:undefined;
						if(!stopAtUseBlocks&&parent.usingLabels&&!parents[parents.length-1]?.withBlock_isLeftArg){
							//assume: parent.type:"use"|"with"
							let param;
							if(parent.type == "use"){//'()>'
								//parent.usingLabels:string[]
								param=parent.usingLabels.includes(name);
							}
							else if(parent.type == "with"){//'()=>' or '()<=>'
								//parent.usingLabels:Map[]
								param=parent.usingLabels.get(name);
							}
							if(!param){
								//stops the param search from passing through the 'use block' filter
								if(getParam(name,parent,[...parents,parent],true)?.param)param = NaN;
								else param = undefined;
								return {param,parents};
							}
						}
						let param = 
							parent.type=="with"?parent.publicLabels.get(name):
							checkForSelfRef(parent?.currentLabels?.get?.(name))
							??checkForSelfRef(parent?.startLabels?.get?.(name))
						;
						parents?.push?.(parent);
						if(parent.type=="with"&&param)parents=undefined;
						if(param===null && parent.parent){
							let ans = getParam(name,parent.parent,parents);
							if(ans.param)return ans;
						}
						return param!==undefined?{param,parents}:
							parent.parent?
								getParam(name,parent.parent,parents)
								:{param,parents}
						;
					}
					function checkParam(param,match,parents){
						if(!param){//param:undefined|null|NaN
							let parent = parents[parents.length-1];
							if(param===null)match.id.throwError("reference", "label: '"+match.arg+"' is undefined at this point. A direct self reference may of been attempted. Self referenceing is not allowed.",a=>Error(a));
							else if(param!==param)match.id.throwError("reference", "label: '"+match.arg+"' can not be reached from within  the local "+
								(match.type=="use"?
									"use-block '( ... ) > ...'" : parent.options[0]=="<"?
									"use-with '( ... ) <=> ...'":
									"use-with '( ... ) => ...'"
								)+"\n"+
								"Cannot reference outside values unless they are passed into the block.\n"+
								//"Try adding '"+match.arg+"' into the '( ... )' part of the block shown bellow.\n"+
								parent.id.displayWordInLine("caught here")
							,a=>Error(a));
							else match.id.throwError("reference", "label: '"+match.arg+"' is undefined",a=>Error(a));
						}
					}
					function handleMultiAssign(value,param){
						if(param.owner.options[0]=="{"){//is multi assign namespace
							return [NameSpace.get,value,new StringExp(param.name[0])];
						}
						else if(param.owner.options[0]=="["){//is multi assign list
							return [List.get,value,new Int(param.index)];
						}
						else return value;
					}
					function parseNumber(word){
						let base = word[1]=="b"?2:word[1]=="x"?16:10;
						return !isNaN(+word)?+word:(([a,b])=>+a+b/base**b.length)(word.split("."));
					}
					function parseNumber_isFloat(word){
						return !!word.match(".");
					}
					function setPublicLabel(parent,param,isStartingLabel=false,isReference){
						//isReference: true => 'a', false => 'a<='
						let name = param.name[0];
						while(parent.parent&&!parent.withBlock_isLeftArg&&(parent instanceof BracketPattern || [","].includes(parent?.pattern))){
							parent = parent.parent;
						}
						//assert: parent.type is "assignment" | "with"
						if(parent.withBlock_isLeftArg)parent=parent.parent;
						else if(isReference)return;//stops '(a, a= b<=2)' from parsing to '(b <= 2,a = b<=2)'
						if(isStartingLabel&&parent.publicLabels?.has?.(name))return;
						//assume:parent.publicLabels and parent.usingLabels is only assigned inside here
						//assume:parent.usingLabels == parent.publicLabels?
						let isValid = !!function checkLabels(param,parent){//:bool ; checks that the with-block's param's are valid.
							//UNFINISHED
							return true;
						}(param,parent);
						if(isValid){
							if(!parent.publicLabels)parent.publicLabels = new Map;
							parent.publicLabels.set(name,param);
							if(parent.type == "with" && parent.usingLabels){//'()=>' or '()<=>' with&use block
								parent.usingLabels.set(name,param);
							}
						}
					};
				//----
				//mutates context
				function* getPatterns(tree,bracketContext){
					let context = bracketContext;
					let word;
					let isFirst=true;//marks the start of a list e.g. ',' or '('. Is used to sepparate certain patterns.
					let propertyAssignmentList=[];//'a.b.c=x'
					tree = tree.filter(filterTree);
					for(let i=0;i<tree.length;){
						word = getWord(tree,i);
						let match = match_pattern(tree,i);
						if(context.pattern == "." && context.params?.[0])isFirst=false;//if '.b' then end the '.' block
						if(!isFirst)while(context.pattern=="::"||context.pattern == "."){//takes in a single, short expression. '::a ...' and '.b ...'
							context=context.parent;
						}
						if(match.pattern||(match instanceof Simple)){
							({i}=match);
							if(match.pattern == "()>")match.usingLabels = match.params.map(v=>v.name[0]);//:Map(string,Param)
							else if(match.pattern == "."){//'a.b'
								//assert: 'a.b' -> '(.)a "b"'
								//prevent '(. b)' or ', . b' from evaling to '()'
								if(isFirst){//if no 'a' or 'b' argument '(.)' is parsed as a label
									//'a . . b' -> '(. a (.))b'
									const simple = new Simple({arg:word,id:match.id,type:"symbol",isFirst,parent:context});
									simple.value = NameSpace.get;
									if(match.params[0])i--;//'.b' -> '(.)b' instead of '(.)()"b"'
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
								match.firstValue = match_arg.pattern=="."?match_arg.firstValue:match_arg instanceof Simple?match_arg:null;//:Simple|null
								//match_arg.isFirst = true;
								match.list.push(match_arg);
							}
							else if(match.pattern == "::"){//get left arg match for 'r :: a'
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
							let withBlock_pattern = (word=getWord(tree,i+2))?.match?.(/<?=>?/);//:bool|Pattern?
							if(withBlock_pattern){//with statement
								//()=, ()=>, ()<=, ()<=>
								//withBlock_pattern.options: "=" | "=>" | "<=" "<=>"
								//withBlock_pattern.list: ['(...)=' , '()=...']
								withBlock_pattern = new Pattern({pattern:"()=",options:word,type:"with",list:[bracket],parent:context,isFirst,id:getID(tree,i+2),publicLabels:new Map});
								if(word.match(">"))withBlock_pattern.usingLabels = new Map;
								bracket.isFirst = true;
								bracket.parent = withBlock_pattern;
								bracket.withBlock_isLeftArg = true;
								context.list.push(withBlock_pattern);
							}
							else context.list.push(bracket);
							yield*getPatterns(tree[i],bracket);
							++i;
							if(withBlock_pattern){//'()='
								++i;
								context = new BracketPattern({pattern:",",list:[],parent:withBlock_pattern,id:getID(tree,i),isFirst:true});
								withBlock_pattern.list.push(context);
								++i;
								isFirst = true;
								continue;
							}
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
							if(bracketContext.pattern=="[]"&&bracketContext.list[0]?.pattern!=","){//if comma used in list, then all list items are separated by commas
								let newListStart = new BracketPattern({pattern:",",parent:bracketContext,list:[...bracketContext.list],isFirst,id});
								bracketContext.list = [newListStart];
								for(let match of newListStart.list){
									if(match.parent==bracketContext)match.parent = newListStart;
								}
							}
							bracketContext.list.push(context);
							isFirst=true;
							i++;
							continue;
						}
						else {
							let match = new Simple({id:tree[i][1],arg:word,type:"symbol",parent:context,isFirst});
							//'a.b='
							if(match.arg.match(/<?=>?/) && context.list.length>0 
								&& context.list[context.list.length-1].pattern=="."
							){//supports 'a.b.c=' aswell
								//assume: pattern 'a=' will not be found since 'a.b=' -> '(a.b)(=)'
								const propertyChain = context.list.pop();
								match = new Pattern({pattern:"a.b=",type:"property_assignment",id:match.id,list:[propertyChain],params:[]});
								propertyChain.parent = match;
								match.firstValue = propertyChain.firstValue;//:Simple?
								if(match.firstValue){//if 'a.b=' instead of '(a).b='
									match.options = word;//reassign
									match.params = [new Param({name:[match.firstValue.arg,match.firstValue.id],owner:match,index:0})];
								}
								match.isFirst=isFirst;
								match.parent = context;
								yield match;
								context.list.push(match);
								context=match;
								isFirst=true;
								i++;
								continue;
							}
							yield match;
							context.list.push(match);
						};
						i++
						isFirst=false
					}
				}
				const context = new BracketPattern({parent:globalContext,value:new Lazy});
				[...getPatterns(tree,context)];//mutates context
				passes:{
					//getAssignments:
					//find definisions & make match.value
					for(let [match,i,bracketParent] of forEachPattern()){
						match.funcLevel = match.parent?.funcLevel || 0;
						if(match.parent.pattern == "::" && i==0)match.funcLevel--; //'r' does use the inner '::' context
						if(match.type == "assignment" || (match.type == "property_assignment" && match.firstValue)){//'=' or 'a.b='
							if(bracketParent.pattern==","){
								bracketParent=bracketParent.parent;
							}
							const isPublic = !!match.options.includes("<");
							if(isPublic){
								for(let param of match.params){
									if(!bracketParent.value.labels)bracketParent.value.labels = new Map();
									bracketParent.value.labels.set(param.name[0],handleMultiAssign(param.value,param));
									setPublicLabel(match.parent,param,true);
								}
							}
							//assume: bracketParent == match.parent
							{//set up assignment properties
								bracketParent.startLabels ??= new Map();//String|Number => Param
								bracketParent.currentLabels ??= new Map();
							}
							let startLabels=bracketParent.startLabels;
							let i=0;
							match.value = [];//single value, represents the right side of the assignment.
							for(let param of match.params){//param:Param
								if(!startLabels.has(param.name[0]))startLabels.set(param.name[0],param);
								param.value = match.value;
							}
						}
						else if(match.type == "property_assignment"){
							match.value = [];
						}
						else if(match.type == "function"){//'>' ; assume pre-fix
							if(match.pattern==">")match.startLabels = new Map(match.params.map(v=>[v.name[0],v]));
							match.funcLevel++;
							match.value = new Lambda;
						}
						else if(match.type == "recursion"){//'::'
							match.value = new RecurSetter();
							match.funcLevel++;
						}
						else if(match.pattern == "."){
							match.value = [NameSpace.get];//args are added in the next pass
						}
						else if(match.pattern == "()="){//with_block
							//UNFINISHED: with/use is not fully implemented
							if(match.options.includes(">"))match.usingLabels = new Map;//:Map(string,Param) ; for with_use patterns '()=>' and '()<=>'
							match.value = [];//this value isn't used in final code.
						}
						else if(match.pattern == "()>"){//use_block
							//UNFINISHED: with/use is not fully implemented
							match.value = [];//new Lazy;
						}
						else if(match instanceof BracketPattern){
							if(match.pattern=="()" || match.pattern == ","){
								match.value = [];
							}
							if(match.pattern=="[]"){
								match.value = [];
								match.value.isList = true;//is converted to a list at the end
							}
							if(match.pattern=="{}"){
								match.value = [];
								match.value.labels = new Map;
							}
						}
						if(match.value){
							match.value.id = match.id;
						}
					}
					//assert:'a.b' -> '(. a b)'
					//find and link references. fill in match.value
					for(let [match,i,bracketParent,list] of forEachPattern(new Pattern())){
						{//assign labels in post-fix
							//BODGED
							let match = list[i-1];
							if(match)
							if(match.type == "assignment" || (match.type == "property_assignment" && match.firstValue)){//'=' and 'a.b='
								if(bracketParent.pattern==","){
									bracketParent=bracketParent.parent;
								}
								const isPublic = !!match.options.includes("<");
								for(let param of match.params){
									bracketParent.currentLabels.set(param.name[0],param);
									if(isPublic){
										bracketParent.value.labels.set(param.name[0],handleMultiAssign(param.value,param));
										setPublicLabel(match.parent,param,false);
									}
								}
							}
						}
						if(match.type == "assignment" || (match.type == "property_assignment" && match.firstValue)){//'=' and 'a.b='
							if(bracketParent.pattern==","){
								bracketParent=bracketParent.parent;
							}
							const isCode = !!match.options.includes(">");
							if(isCode){
								const paramMap = param=>Object.assign(new Reference(param.value),{levelDif:0,id:param.id});
								if(match.options[0]=="{")match.parent.value.push(Object.assign([],{id:match.id,labels:new Map( match.params.map(param=>[param.name[0],paramMap(param)]) )}));
								else if(match.options[0]=="[")match.parent.value.push(Object.assign(match.params.map(param=>paramMap(param)),{id:match.id,isList:true}));
								else match.parent.value.push(match.value);
								match.isUsed = true;
							}
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
										match.value = Object.assign(new (parseNumber_isFloat(match.arg)?Float:Int)(parseNumber(match.arg)),{id:match.id});
									}
								}
								else if(match.type=="string"){
									if(!param){
										let string = parseString(match.arg);
										match.value = Object.assign(new StringExp(string),{id:match.id});
									}
								}
								if(match.value == undefined) {//not already defined
									//note: number literals & other predefined values can be used as either an Int or a parameter reference
									checkParam(param,match,parents);
									addRefParam(match,parents,param);
									//assert: param != undefined
									match.ref = param;
									if(param.owner.type == "function"){
										let refLevel = match.funcLevel-param.owner.funcLevel;
										match.value = handleMultiAssign(refLevel,param);
										match.value.id = match.id;
									}
									else if(param.owner.type == "assignment"){
										const paramValue = param.value;
										const levelDif = match.funcLevel-param.owner.funcLevel;
										match.value = handleMultiAssign(Object.assign(new Reference(paramValue),{levelDif,id:match.id}),param);
										param.owner.isUsed = true;
									}
									else{
										match.value = param.value;
									}
									if(match.value==undefined)throw Error("compiler error");
									//if(match.value instanceof NameSpace)
									if(param.owner.publicLabels){
										for(let [i,v] of param.owner.publicLabels)
											setPublicLabel(match.parent,v,false,true);
									}
									if(match.parent.pattern=="{}"){//BODGED: only supports the '{a b c}' versions of '{}' and not e.g.'{a,b c (a>a a)}'
										match.value.publicLabels
										throw Error ("compiler Error: namespace literals '{ }' are not supported yet.");
									}
								}
							}
							match.parent.value.push(match.value);
						}
						else if(["function","recursion","property","with","use","property_assignment"].includes(match.type))match.parent.value.push(match.value);
						else if(match instanceof BracketPattern){//',' '()' '[]' '{}'
							if(match.parent.type == "with" && match.parent.list[0] == match)continue;
							if(match.parent.type == "with"){
								if(match.parent.options[0]=="<")
								for(let [i,param] of match.parent.publicLabels){
									match.parent.parent.value.labels??=new Map();
									match.parent.parent.value.labels.set(param.name[0],handleMultiAssign(param.value,param));
									setPublicLabel(match.parent.parent,param,false);
								}
							};
							match.parent.value.push(match.value);
						}
						else if(match.pattern!=undefined) throw Error("compiler error: '"+match.type+"' haven't enumerated all possibilities");
					}
					refs.checkRefs();
					//handle references to null values
					for(let [match,i,bracketParent] of forEachPattern()){
						if(match.pattern == "="){
							if(match.isUsed){
								if(match.value.length == 0){
									match.value.push(Lambda.null);
								}
							}
							else{
								//warning dead code
							}
						}
					}
					//finds recursion pattern 'r' in 'r :: a'.
					//parses 'a.b' where b is a label
					for(let [match,i,bracketParent] of forEachPattern()){
						if(match.pattern=="::"){
							match.value.recur = Object.assign([match.value.shift()],{id:match.list[0].id});
						}
						else if(match.pattern=="." && match.params?.length==1){
							let [word,id] = match.params[0].name;
							if(match.options == "index"){
								match.value[0] = List.get;
								match.value.push(Object.assign(new Int(parseNumber(word)),{id}))
							}
							else if(match.options == "property"){
								//assume: match.value[0] == NameSpace.get
								match.value.push(Object.assign(new StringExp(word),{id}));
							}
						}
					}
					//assign 'a.b=' patterns, (property chain assignment)
					for(let [match] of forEachPattern()){//must be done after 'a.b's are parsed and assigned.
						if(match.type == "property_assignment"){//'a.b='
							let property = match.list[0];//'(.) b "c"'
							let value = match.list[1].value;
							//'a.b' -> '{a,b=}'
							match.value.splice(0,match.value.length);
							while(property.type == "property"){//'a.b.c=' ; note 'a.b.c=' represents property chain assignment.
								value = [NameSpace.set,property.value[1],property.value[2],value];
								value.id=property.value.id;
								property=property.list[0];
							}
							//assert: match.value = '(=) (a) "b" ((=) (a.b) "c" value) '
							match.value.push(value);
							match.value.id=match.id;//the array is only used to add match.id to the construct.
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
						let skipOperator = false;
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
									let nextOperatorHasLeftArg = list[i].operatorParamObj?.length==2;
									if(nextOperatorHasLeftArg)i++;//skips next operator ; allows for '* / a' -> '((/)(*)a)'
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
							if(match.value.length == 1 || (index == 0 && match.parent.pattern != "[]")){//allow for '[,a,b,c]'
								match.parent.value.splice(index,1,...match.value);
								match.list.forEach(v=>v.parent=match.parent);
							}
						}
					}
					//parse null values and simplify expressions: '()' -> `Lambda.null`
					for(let [match,i,bracketParent] of forEachPattern()){
						if([Lambda,Array,RecurSetter,Reference].includes(match.value.constructor)){
							if(match.value.constructor == Array && (match.value.isList||match.value.labels))continue;
							if(match.value.length==0){//match.value:Array|Lambda|RecurSetter
								let index = match.parent.value.indexOf(match.value);
								if(index!=-1)//may of already been removed ealier
									match.value.labels||match.value.isList?match.value.push(Lambda.null):match.parent.value.splice(index,1,Lambda.null);
							}
						}
					}
					if(context.value.length==0)context.value.push(Lambda.null);//
					//check for the empty expression compiler error
					context.value.forEach(function forEach(v,i,a){
						if(v instanceof RecurSetter)forEach(v.recur);
						//else if(v instanceof NameSpace)throw Error("compiler error: illegal type in source code")//v.labels.forEach(v=>forEach(v.value));
						//else if(v instanceof List)throw Error("compiler error: illegal type in source code")//v.labels.forEach(v=>forEach(v.value));
						else 
						if(v instanceof Array){
							if(v.constructor == Array && (v.isList||v.labels)){}
							else if(v.length == 0 && !v.labels)throw Error("compiler error: non-nulled empty list found"+(console.log(v,i)??""));
							v.forEach(forEach);
						}
					})
				};

				return context;
			}
			let regex =/\s+|\/\/.*|\/\*[\s\S]*\*\/|λ|\b(?:[0-9]+(?:\.[0-9]*)?|0x[0-9a-fA-F]+(?:\.[0-9a-fA-F]*)?|0b[01]+(?:\.[01]*)?)\b|\b\w+\b|"(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*'|`(?:[^`\\]|\\[\s\S])*`|::|<=>|[!%^&*-+~<>]=|=>|([+\-*&|^=><])\1?|[^\s]/g;
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
				Object.assign(file,{tree,context,expression});
				return file;//parse(tree);
			}
			return main();
		}
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
	compile.isExpression = function(obj){return !!obj?.[Exp.symbol]};
	compile.null = function(obj){return Lambda.null};
	compile.exp=Exp;
}
//bug: 'a = b = 1' -> null error
//only do it in nodeJS
if(!globalThis.window)require("fs").readFile(process.argv[2]??"./test.lcpp","utf8",(err, data) => {
	if(!err)tryCatch(()=>{//λ
		(compile(data).evalFully())
	});
	else console.log(error)
});