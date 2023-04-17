//Exp: Lambda'λ' | Lazy'()' | Recur'::'
class Exp extends Array{//expression
	call(exp){return exp}//:Exp->Lambda|Lazy
}
class Recur extends Exp{//'Exp::Exp'
	constructor(arg,num){//arg,num:Exp
		super(2);
		Object.assign(this,data);
	}
	//[]
}
class Lambda extends Exp{//'λ ...' or 'param>...'
	constructor(data){
		super();
		Object.assign(this,data);
	}
}
class Lazy extends Exp{//'(...)'
	//lazy evaluationBlock
	//Are only evaluated when called as a function
	constructor(...list){
		super();
		this.splice(0,0,...list);
	}

}
function compile (text){

}